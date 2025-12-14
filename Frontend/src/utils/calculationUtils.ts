/**
 * Calculation Utilities
 * Handles all calculation logic for treatments, totals, and financial computations
 */

import type { TreatmentForm } from '@/schemas/validation.schema';

/**
 * Calculate total cost from treatment items
 * @param treatments - Array of treatment items
 * @returns Total cost as string with 2 decimal places
 */
export function calculateTotal(treatments: TreatmentForm[]): string {
  return treatments.reduce((sum, item) => {
    const sessions = Number(item.sessions || 0);
    const perSession = Number(item.amount || 0);
    return sum + (sessions * perSession);
  }, 0).toFixed(2);
}

/**
 * Calculate cost per treatment item
 */
export function calculateTreatmentCost(sessions: number, amountPerSession: number): number {
  return sessions * amountPerSession;
}

/**
 * Calculate total paid amount
 */
export function calculateTotalPaid(paymentsDone: number[]): number {
  return paymentsDone.reduce((sum, payment) => sum + payment, 0);
}

/**
 * Calculate remaining balance
 */
export function calculateRemainingBalance(total: number, paid: number): number {
  return total - paid;
}

/**
 * Format number to currency string
 */
export function toCurrencyString(value: number): string {
  return `₹${value.toFixed(2)}`;
}

/**
 * Parse currency string to number
 */
export function parseCurrency(currencyString: string): number {
  const cleaned = currencyString.replace(/[₹,]/g, '');
  return parseFloat(cleaned) || 0;
}
