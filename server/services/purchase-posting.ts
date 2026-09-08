// server/services/purchase-posting.ts
// Implements spec §35 ("Single Source of Truth"): posting a purchase must
// atomically update every dependent view, or none of them. This is the one
// place that fan-out happens — no module writes these tables directly.
//
// Fixed during the Phase 1 hardening pass: PurchaseLine.productId and
// Purchase.vendorId are both nullable now (client purchase lines only ever
// carry a product NAME, and a WhatsApp-pasted draft can have no vendor
// resolved yet). InventoryMovement.productId and VendorProductRate.vendorId/
// productId are NOT nullable in the schema — so a line/purchase that never
// got resolved to a real id must be skipped for those two tables rather than
// crash the whole post, and that skip must be visible, not silent.

import type { PrismaClient } from '@prisma/client';

export interface PostPurchaseResult {
  purchase: unknown;
  skippedLines: { lineId: string; productName: string; reason: string }[];
}

export async function postPurchase(db: PrismaClient, purchaseId: string, actorId: string): Promise<PostPurchaseResult> {
  return db.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUniqueOrThrow({
      where: { id: purchaseId },
      include: { lines: true, vendor: true },
    });

    if (purchase.status !== 'VERIFIED') {
      throw new Error('Only a VERIFIED purchase can be posted');
    }

    const skippedLines: PostPurchaseResult['skippedLines'] = [];

    for (const line of purchase.lines) {
      if (!line.productId) {
        // Can't post an inventory movement against no product. This purchase line
        // stays on record (productName is preserved) but doesn't touch stock or
        // vendor rate history until someone resolves it to a real catalogue item.
        skippedLines.push({ lineId: line.id, productName: line.productName, reason: 'No matching product — could not update inventory' });
        continue;
      }

      // 1. Inventory movement, sourced as PURCHASE
      await tx.inventoryMovement.create({
        data: {
          productId: line.productId,
          delta: line.quantity,
          reason: `Purchase ${purchase.id} posted`,
          source: 'PURCHASE',
          refType: 'Purchase',
          refId: purchase.id,
          createdById: actorId,
        },
      });

      // Keep the denormalized current-state stock field in sync too (see Product
      // model comment — it's authoritative until Phase 2 derives it from movements).
      await tx.product.update({
        where: { id: line.productId },
        data: { stock: { increment: line.quantity } },
      });

      // 2. Vendor rate history — powers Product 360 / Vendor 360 price intelligence.
      // Requires a resolved vendor; a still-unassigned purchase can't be posted
      // (see the status guard above — POSTED implies VERIFIED implies a real vendor
      // was set in normal flow) but we guard anyway rather than trust that invariant.
      if (purchase.vendorId) {
        await tx.vendorProductRate.create({
          data: {
            vendorId: purchase.vendorId,
            productId: line.productId,
            rate: line.netRate,
            effectiveAt: new Date(),
            purchaseId: purchase.id,
          },
        });
      } else {
        skippedLines.push({ lineId: line.id, productName: line.productName, reason: 'No vendor resolved — vendor rate history not updated' });
      }
    }

    // 3. Purchase status + timestamp
    const posted = await tx.purchase.update({
      where: { id: purchase.id },
      data: { status: 'POSTED', postedAt: new Date() },
    });

    // 4. Audit trail — old/new status, actor, source, and any skipped lines so a
    //    partial post is discoverable, not silent.
    await tx.auditLog.create({
      data: {
        actorId,
        entityType: 'Purchase',
        entityId: purchase.id,
        action: 'post',
        oldValue: { status: 'VERIFIED' },
        newValue: { status: 'POSTED', skippedLines },
        source: 'MANUAL',
      },
    });

    // Reports, Product 360, and Vendor 360 are all *read* off InventoryMovement /
    // VendorProductRate / Purchase directly — nothing further to write here.
    // That's what makes this the single source of truth: there is no
    // second copy of "posted" data anywhere else to drift out of sync.

    return { purchase: posted, skippedLines };
  });
}
