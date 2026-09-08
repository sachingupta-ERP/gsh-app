// src/data/repositories/types.ts
// Canonical client-side types mirroring prisma/schema.prisma — imported by every
// module so the UI and the eventual API client agree on shape.

export type DomsLine = 'LINE_1' | 'LINE_2' | null;

export interface ProductVariant {
  id: string;
  label: string; // "Blue", "Black", "Red"...
  quantity: number;
}

export interface Product {
  id: string;
  alias: string; // globally unique — enforced by repository.create()
  name: string;
  category: string;
  brand: string;
  domsLine: DomsLine; // only ever set when brand === 'DOMS'
  unit: string;
  imageUrl?: string;
  icon?: string; // cosmetic display emoji
  minStock: number;
  reorderQty?: number;
  purchaseRate: number;
  sellingRate: number;
  // Phase 1 authoritative field — a direct, mutable current-state value, NOT derived
  // from variants/movements. Deriving it from InventoryMovement instead is documented
  // Phase 2 work (see Product model comment in prisma/schema.prisma); until then this
  // is the number every screen and the AI assistant reads.
  stock: number;
  variants: ProductVariant[];
}

export interface InventoryMovement {
  id: string;
  productId: string;
  variantId?: string;
  delta: number; // signed
  reason: string;
  source: 'VOICE' | 'MANUAL' | 'PURCHASE' | 'SALE_ADJUSTMENT' | 'IMPORT' | 'AI' | 'ADMIN';
  createdById: string;
  createdAt: string;
}

export interface VendorProductRate {
  vendorId: string;
  vendorName: string;
  rate: number;
  effectiveAt: string;
}

export interface Product360 {
  product: Product;
  movements: InventoryMovement[];
  vendorRates: VendorProductRate[]; // grouped by vendor upstream
  margin: number; // percent
  stockValue: number;
  reorderStatus: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OK';
}

// Structured draft returned by the voice-parsing service (§11) —
// always shown to the user for CONFIRM / EDIT / CANCEL before it touches inventory.
export interface VoiceInventoryDraft {
  transcript: string;
  matchedProductId: string | null;
  matchConfidence: number; // 0-1
  purchaseRate?: number;
  sellingRate?: number;
  variantDeltas: { label: string; quantity: number }[];
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson?: string;
  mobile?: string;
  whatsapp?: string;
  address?: string;
  paymentTerms?: string;
  notes?: string;
  active: boolean;
  // Phase 1 denormalized current-state (matches Vendor model in prisma/schema.prisma) —
  // computing these from VendorBill/Purchase relations instead is Phase 2 work.
  terms?: string;
  monthSpend: number;
  billsCount: number;
  reviewCount: number;
}

export type BillReviewStatus = 'AI_REVIEW_REQUIRED' | 'VERIFIED' | 'NOT_APPLICABLE';

export interface VendorBill {
  id: string;
  vendorId: string;
  billNumber?: string;
  billDate: string;
  amount?: number;
  documentUrl: string; // always retained — §13
  ocrRawText?: string;
  ocrConfidence?: number;
  reviewStatus: BillReviewStatus;
  purchaseId?: string;
}

export interface Vendor360 {
  vendor: Vendor;
  bills: VendorBill[]; // chronological
  productRates: { productId: string; productName: string; history: { rate: number; date: string }[] }[];
  monthSpend: number;
  monthBillCount: number;
  unpaidTotal: number;
}

export type PurchaseStatus = 'DRAFT' | 'SENT' | 'RECEIVED' | 'REVIEW' | 'VERIFIED' | 'POSTED';

export interface PurchaseLine {
  id: string;
  productId?: string; // resolved best-effort by matching productName — not always present
  productName: string;
  quantity: number;
  grossRate: number;
  discountPct: number;
  netRate: number;
  amount: number; // line total as actually recorded — see PurchaseLine.amount in schema for why
                   // this isn't just recomputed as quantity × netRate
}

export interface Purchase {
  id: string;
  vendorId?: string; // absent for a WhatsApp-pasted draft until a vendor is assigned
  vendorName: string;
  status: PurchaseStatus;
  source: 'VOICE' | 'MANUAL' | 'WHATSAPP_PASTE';
  orderedAt: string;
  receivedAt?: string;
  postedAt?: string;
  lines: PurchaseLine[];
  total: number;
  paid: number;
  linkedBillId?: string;
}

// Structured draft from voice receiving (§12) — always previewed before commit
export interface VoicePurchaseDraft {
  transcript: string;
  vendorId: string | null;
  vendorMatchConfidence: number;
  productId: string | null;
  quantity?: number;
  grossRate?: number;
  discountPct?: number;
  netRate?: number;
  paymentGiven?: number;
}

// One parsed line from a pasted WhatsApp-style order (§23)
export interface WhatsAppOrderLine {
  rawText: string;
  matchedProductId: string | null;
  matchConfidence: number;
  quantity: number;
}

export interface DailyClosing {
  date: string;
  openingCash: number;
  cashSales: number;
  upiSales: number;
  expenses: number;
  purchases: number;
  creditSales: number;
  expectedCash: number;
  actualCash: number;
  variance: number;
  varianceReason?: string;
  closedById: string;
  closedAt: string;
}

export type ExpenseCategory = 'Packaging' | 'Transport' | 'Tea/snacks' | 'Personal use' | 'Miscellaneous' | 'Other';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  note?: string;
  imageUrl?: string;
  date: string;
  createdById: string;
}

export interface ImportRow {
  rowIndex: number;
  alias: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  openingQty: number;
  purchaseRate: number;
  sellingRate: number;
  minStock: number;
  status: 'OK' | 'DUPLICATE_ALIAS' | 'MISSING_FIELD';
  issue?: string;
}
