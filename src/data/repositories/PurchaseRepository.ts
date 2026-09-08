// src/data/repositories/PurchaseRepository.ts

import type { Purchase, PurchaseStatus, VoicePurchaseDraft, WhatsAppOrderLine } from './types';

// Legal forward transitions only — the UI's "advance" action always maps
// through this table so an invalid jump (e.g. DRAFT -> POSTED) can't happen
// from a stale client.
export const NEXT_STATUS: Record<PurchaseStatus, PurchaseStatus | null> = {
  DRAFT: 'SENT',
  SENT: 'RECEIVED',
  RECEIVED: 'REVIEW',
  REVIEW: 'VERIFIED',
  VERIFIED: 'POSTED',
  POSTED: null,
};

export interface PurchaseRepository {
  list(params?: { status?: PurchaseStatus; vendorId?: string }): Promise<Purchase[]>;
  get(purchaseId: string): Promise<Purchase>;
  createDraft(input: Omit<Purchase, 'id' | 'status' | 'paid'>): Promise<Purchase>;

  /**
   * Advances exactly one step via NEXT_STATUS. When the resulting status is
   * POSTED, the server transactionally fans this out per spec §35:
   * inventory movements + vendor ledger + vendor rate history + reports +
   * Product 360 / Vendor 360 all update together, or none do.
   */
  advanceStatus(purchaseId: string): Promise<Purchase>;

  recordPayment(purchaseId: string, amount: number, method: 'cash' | 'upi' | 'credit'): Promise<Purchase>;

  // --- AI-assisted entry points ---
  parseVoiceReceiving(transcript: string): Promise<VoicePurchaseDraft>;
  commitVoiceReceiving(draft: VoicePurchaseDraft): Promise<Purchase>;

  parseWhatsAppOrder(text: string): Promise<WhatsAppOrderLine[]>;
  commitWhatsAppOrder(lines: WhatsAppOrderLine[], vendorId: string | null): Promise<Purchase>;
}
