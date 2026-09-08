// server/services/ai-assistant.ts
// Ask GSH AI (§28). This is deliberately NOT a free-text LLM answering from its own
// knowledge — it's a grounded query engine: classify intent, run a real query against
// Prisma, return the answer + the exact rows used. An LLM call (if added later) is
// only ever used for intent classification / phrasing, never for producing the
// numbers themselves — those always come from the query result.

import type { PrismaClient } from '@prisma/client';

export interface AskResult {
  text: string;
  citedRefs: { type: string; id: string; label: string }[];
  explain: string;
  unavailable: boolean;
}

export async function askGSH(db: PrismaClient, query: string, userId: string): Promise<AskResult> {
  const intent = classifyIntent(query); // keyword/pattern match — same table as the client engine

  const result = await runIntent(db, intent, query);

  // Every interaction is logged with its citedRefs so a human can audit exactly
  // what data an answer was based on, days later (§28, §36).
  await db.aiInteraction.create({
    data: { userId, query, responseText: result.text, citedRefs: result.citedRefs },
  });

  return result;
}

type Intent =
  | 'current_stock' | 'low_stock' | 'rate_lookup' | 'best_vendor_rate'
  | 'vendor_price_change' | 'last_purchase' | 'yesterday_sales' | 'month_profit'
  | 'vendor_spend' | 'expected_cash' | 'purchase_priority' | 'business_summary'
  | 'unknown';

function classifyIntent(query: string): Intent {
  const q = query.toLowerCase();
  if (/low.?stock|stock.?out|reorder|khatam ho/.test(q)) return 'low_stock';
  if (/stock|kitna.*(bacha|hai)|available/.test(q)) return 'current_stock';
  if (/(lowest|cheapest|best|sasta).*(rate|price|vendor)/.test(q)) return 'best_vendor_rate';
  if (/raised?.(price|rate)|badh/.test(q)) return 'vendor_price_change';
  if (/last (purchase|bought|order)|kab.*(khareed|liya)/.test(q)) return 'last_purchase';
  if (/rate|price|dp\b/.test(q)) return 'rate_lookup';
  if (/yesterday|kal.*(sale|bikri)/.test(q)) return 'yesterday_sales';
  if (/profit|munafa/.test(q) && /month|mahine/.test(q)) return 'month_profit';
  if (/spend|kharcha/.test(q)) return 'vendor_spend';
  if (/budget|kya khareed|priority purchase/.test(q)) return 'purchase_priority';
  if (/business summary|overview/.test(q)) return 'business_summary';
  if (/cash/.test(q)) return 'expected_cash';
  return 'unknown';
}

async function runIntent(db: PrismaClient, intent: Intent, query: string): Promise<AskResult> {
  switch (intent) {
    case 'current_stock': {
      const product = await matchProduct(db, query);
      if (!product) return unavailable(`I don't have a product matching that name in Inventory.`);
      // Fixed during the Phase 1 hardening pass: this used to sum product.variants,
      // which is empty for every synced product (sync writes the flat `stock` field,
      // not ProductVariant rows) — so it always returned 0. `stock` is the
      // authoritative Phase 1 field; see the schema comment on Product.
      return {
        text: `${product.name} currently has ${product.stock} units in stock${product.stock < product.minStock ? ` — below the reorder point of ${product.minStock}.` : '.'}`,
        citedRefs: [{ type: 'Product', id: product.id, label: product.name }],
        explain: `Read the live "stock" field for "${product.name}" from Inventory directly.`,
        unavailable: false,
      };
    }
    // Each remaining intent follows the same shape as its client-side counterpart in
    // preview/index.html's askGSH() — see that file for the full reference
    // implementation of low_stock, best_vendor_rate, vendor_price_change,
    // last_purchase, rate_lookup, yesterday_sales, month_profit, vendor_spend,
    // purchase_priority, business_summary, and expected_cash. Ported here 1:1 against
    // Prisma queries once the server is stood up, so behavior never diverges between
    // the demo and the production engine.
    default:
      return unavailable(
        `I can answer questions about product rates and stock, vendor comparisons and spend, purchase history, sales/profit, low stock, and expected cash. I don't understand that question yet.`
      );
  }
}

async function matchProduct(db: PrismaClient, query: string) {
  const q = query.toLowerCase();
  const products = await db.product.findMany();
  return products.find((p) => q.includes(p.name.toLowerCase()) || q.includes(p.alias.toLowerCase())) ?? null;
}

function unavailable(text: string): AskResult {
  return { text, citedRefs: [], explain: 'No matching data found for this query.', unavailable: true };
}
