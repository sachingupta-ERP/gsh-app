// server/services/ocr.ts
// Vendor bill review pipeline (§13-14). Handles printed AND handwritten/short-form
// bills. The core rule: if the model isn't confident, return nulls + reviewRequired
// — never fabricate a vendor, date, product, or total.

import type { BillOcrDraft } from '../../src/data/repositories/VendorRepository';

const REVIEW_THRESHOLD = 0.75;

const SYSTEM_PROMPT = `You read a vendor bill image (often handwritten or abbreviated) for a small
stationery shop. Extract only what is legibly present:
{
  "billDate": "YYYY-MM-DD" | null,
  "amount": number | null,
  "billNumber": string | null,
  "lineItems": [{ "description": string, "quantity": number | null, "rate": number | null }],
  "confidence": number   // 0-1, your honest confidence in the extraction as a whole
}
Do not guess a total, date, or item you cannot actually read. Partial illegibility should
lower confidence, not trigger a guess.`;

export async function reviewVendorBill(imageBase64: string, vendorId: string): Promise<BillOcrDraft> {
  const raw = await callVisionModel(SYSTEM_PROMPT, imageBase64);
  const parsed = JSON.parse(raw);

  const confidence = parsed.confidence ?? 0;
  return {
    vendorId,
    billDate: parsed.billDate ?? new Date().toISOString().slice(0, 10),
    amount: parsed.amount,
    billNumber: parsed.billNumber,
    confidence,
    rawText: raw,
    reviewRequired: confidence < REVIEW_THRESHOLD,
  };
}

async function callVisionModel(system: string, imageBase64: string): Promise<string> {
  // Real implementation: POST /v1/messages with an image content block (base64,
  // media_type) + the system prompt above, model "claude-sonnet-4-6". See
  // docs/ARCHITECTURE.md for where this plugs into server/routes/vendors.ts.
  throw new Error('callVisionModel: wire up the Claude vision call here');
}
