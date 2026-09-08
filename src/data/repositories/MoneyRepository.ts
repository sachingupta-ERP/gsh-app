// src/data/repositories/MoneyRepository.ts

import type { DailyClosing, Expense, ExpenseCategory } from './types';

export interface TodayMoneySnapshot {
  openingCash: number;
  cashSales: number;
  upiSales: number;
  purchases: number;
  creditSales: number;
  expenses: Expense[];
  expectedCash: number; // openingCash + cashSales - sum(expenses) - purchases
}

export interface MoneyRepository {
  getTodaySnapshot(): Promise<TodayMoneySnapshot>;

  addExpense(input: { category: ExpenseCategory; amount: number; note?: string; imageUrl?: string }): Promise<Expense>;

  /**
   * Server recomputes expectedCash itself from ledger data — never trusts a
   * client-sent expected value — then requires varianceReason whenever
   * actualCash !== expectedCash (spec §24). Throws VARIANCE_REASON_REQUIRED
   * if omitted.
   */
  closeDay(input: { actualCash: number; varianceReason?: string }): Promise<DailyClosing>;

  getClosing(date: string): Promise<DailyClosing | null>;
}
