// server/services/closing.ts
// Implements the full §24 chain: Sales + Purchases(paid) + Expenses -> Expected Cash
// -> Variance -> Closing record -> next day's opening cash. The server NEVER trusts
// a client-sent "expected" value — it recomputes from the ledger tables every time,
// which is what makes this safe against a stale or tampered client.

import type { PrismaClient } from '@prisma/client';

export async function computeExpectedCash(db: PrismaClient, date: string, openingCash: number) {
  const [cashSales, upiSales, creditSales] = await Promise.all([
    sumSales(db, date, 'cash'),
    sumSales(db, date, 'upi'),
    sumSales(db, date, 'credit'),
  ]);
  const expenses = await db.expense.aggregate({ _sum: { amount: true }, where: { date: dateRange(date) } });
  const purchasesPaid = await db.payment.aggregate({
    _sum: { amount: true },
    where: { method: 'cash', paidAt: dateRange(date) },
  });

  const totalExpenses = expenses._sum.amount ?? 0;
  const totalPurchasesPaid = purchasesPaid._sum.amount ?? 0;
  const expectedCash = openingCash + cashSales - totalExpenses - totalPurchasesPaid;

  return { cashSales, upiSales, creditSales, expenses: totalExpenses, purchases: totalPurchasesPaid, expectedCash };
}

export async function closeDay(
  db: PrismaClient,
  input: { date: string; actualCash: number; varianceReason?: string; closedById: string }
) {
  const previousClosing = await db.dailyClosing.findFirst({ orderBy: { date: 'desc' } });
  const openingCash = previousClosing?.actualCash ?? 0;

  const snapshot = await computeExpectedCash(db, input.date, openingCash);
  const variance = input.actualCash - snapshot.expectedCash;

  if (variance !== 0 && !input.varianceReason) {
    throw new Error('VARIANCE_REASON_REQUIRED');
  }

  // Server-side date uniqueness on DailyClosing.date prevents closing the same
  // business day twice — the client can retry safely without double-counting.
  return db.dailyClosing.create({
    data: {
      date: new Date(input.date),
      openingCash,
      ...snapshot,
      actualCash: input.actualCash,
      variance,
      varianceReason: variance !== 0 ? input.varianceReason : null,
      closedById: input.closedById,
    },
  });
}

function sumSales(db: PrismaClient, date: string, paymentMode: string) {
  // DailySalesEntry rows are written by the Quick Sale Total flow (§17) — never
  // derived from individual product sales, which the spec explicitly forbids
  // fabricating (§18).
  // Fixed during the Phase 1 hardening pass: this used to filter by `mode`, which
  // is the entry-TYPE enum (always QUICK_TOTAL) — not the payment channel. Filtering
  // 'cash'/'upi'/'credit' against that enum would fail at the Prisma type level.
  // The payment channel is `paymentMode`, added specifically to resolve that collision.
  return db.dailySalesEntry
    .aggregate({ _sum: { amount: true }, where: { date: dateRange(date), paymentMode } })
    .then((r) => r._sum.amount ?? 0);
}

function dateRange(date: string) {
  const start = new Date(date + 'T00:00:00.000Z');
  const end = new Date(date + 'T23:59:59.999Z');
  return { gte: start, lte: end };
}
