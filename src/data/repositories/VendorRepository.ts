// src/data/repositories/VendorRepository.ts
// Same pattern as ProductRepository: UI depends only on this interface.

import type { Vendor, Vendor360, VendorBill } from './types';

export interface BillOcrDraft {
  vendorId: string;
  billDate: string;
  amount: number | null;
  billNumber: string | null;
  confidence: number; // 0-1
  rawText: string;
  reviewRequired: boolean; // true when confidence is too low to trust the extraction (§14)
}

export interface VendorRepository {
  list(params?: { query?: string; activeOnly?: boolean }): Promise<Vendor[]>;
  get360(vendorId: string): Promise<Vendor360>;
  create(input: Omit<Vendor, 'id'>): Promise<Vendor>;
  update(vendorId: string, patch: Partial<Vendor>): Promise<Vendor>;

  /** Runs OCR on a captured/uploaded bill image. Never invents data — low-confidence
   *  fields come back null and reviewRequired: true rather than a guessed value (§14). */
  scanBill(vendorId: string, image: Blob): Promise<BillOcrDraft>;

  attachBill(vendorId: string, draft: BillOcrDraft, image: Blob): Promise<VendorBill>;

  /** Manual correction after AI_REVIEW_REQUIRED — always audit-logged (§36). */
  correctBill(billId: string, patch: Partial<VendorBill>): Promise<VendorBill>;

  getBillDocumentUrl(billId: string): Promise<string>;
}
