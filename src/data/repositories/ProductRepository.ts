// src/data/repositories/ProductRepository.ts
// Every inventory screen depends on THIS INTERFACE, never on fetch() or a storage
// engine directly. Two implementations exist:
//   - LocalProductRepository   (IndexedDB, works fully offline, used in dev/demo)
//   - RestProductRepository    (talks to /api/v1/products per docs/API_CONTRACTS.md)
// Swapping the implementation in src/data/repositories/index.ts is the only change
// needed to move the whole Inventory module onto a real backend.

import type { Product, Product360, ImportRow, VoiceInventoryDraft } from './types';

export interface DuplicateAliasError {
  code: 'ALIAS_DUPLICATE';
  alias: string;
}

export interface ProductRepository {
  list(params?: { query?: string; category?: string; lowStockOnly?: boolean }): Promise<Product[]>;

  get360(productId: string): Promise<Product360>;

  /** Throws DuplicateAliasError if alias already exists — never silently overwrites. */
  create(input: Omit<Product, 'id' | 'stock' | 'variants'> & { openingQty: number }): Promise<Product>;

  update(productId: string, patch: Partial<Product>): Promise<Product>;

  /** Applies a signed quantity change and writes an InventoryMovement row. */
  adjustStock(input: {
    productId: string;
    variantLabel?: string;
    delta: number;
    reason: string;
    source: 'VOICE' | 'MANUAL' | 'SALE_ADJUSTMENT' | 'ADMIN';
  }): Promise<void>;

  // --- AI-assisted entry points (§11, §19) ---
  parseVoiceEntry(transcript: string): Promise<VoiceInventoryDraft>;
  commitVoiceEntry(draft: VoiceInventoryDraft): Promise<void>;

  // --- Excel import (§37) ---
  previewImport(file: File): Promise<ImportRow[]>;
  commitImport(rows: ImportRow[]): Promise<{ imported: number; skipped: number }>;
}
