// server/services/voice-parser.ts
// Turns a raw speech transcript (Hindi/English, code-mixed) into a VoiceInventoryDraft.
// Never writes to inventory directly — always returns a draft for the client to
// show as CONFIRM / EDIT / CANCEL (spec §11, §19). Swap `callModel` for the real
// Anthropic API call; the parsing contract (prompt → strict JSON) is fixed here so
// the rest of the pipeline doesn't need to change when the model call is wired in.

import type { VoiceInventoryDraft } from '../../src/data/repositories/types';

interface ProductIndexEntry {
  id: string;
  alias: string;
  name: string;
  variantLabels: string[];
}

const SYSTEM_PROMPT = `You convert a shopkeeper's spoken Hindi/English inventory update into strict JSON matching this shape:
{
  "matchedProductAlias": string | null,
  "matchConfidence": number,       // 0-1, how sure you are about the product match
  "purchaseRate": number | null,
  "sellingRate": number | null,
  "variantDeltas": [{ "label": string, "quantity": number }]
}
Only use products from the provided catalogue. Never invent a product, rate, or quantity that
was not stated. If nothing matches confidently, set matchedProductAlias to null and
matchConfidence to 0 rather than guessing.`;

export async function parseVoiceTranscript(
  transcript: string,
  catalogue: ProductIndexEntry[]
): Promise<VoiceInventoryDraft> {
  const userPrompt = `Catalogue: ${JSON.stringify(catalogue)}\nTranscript: "${transcript}"\nRespond with JSON only.`;

  const raw = await callModel(SYSTEM_PROMPT, userPrompt);
  const parsed = JSON.parse(raw);

  const matched = catalogue.find((p) => p.alias === parsed.matchedProductAlias);

  return {
    transcript,
    matchedProductId: matched?.id ?? null,
    matchConfidence: parsed.matchConfidence ?? 0,
    purchaseRate: parsed.purchaseRate ?? undefined,
    sellingRate: parsed.sellingRate ?? undefined,
    variantDeltas: parsed.variantDeltas ?? [],
  };
}

async function callModel(system: string, user: string): Promise<string> {
  // Real implementation: POST to /v1/messages with model "claude-sonnet-4-6",
  // system, and a single user message containing `user`, then strip markdown fences.
  // See docs/ARCHITECTURE.md — this file is the seam to wire that in.
  throw new Error('callModel: wire up the Claude API call here (see docs/ARCHITECTURE.md)');
}
