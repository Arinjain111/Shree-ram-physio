/**
 * Invoice Utilities
 * Handles invoice number generation, validation, and formatting
 */

import type { InvoiceData } from '@/schemas/validation.schema';

/**
 * Generate the next invoice number from existing invoices
 * @param invoices - Array of existing invoices
 * @returns Next invoice number in format 0001, 0002, etc.
 */
export function generateNextInvoiceNumber(invoices: InvoiceData[]): string {
  if (invoices.length === 0) {
    return '0001';
  }
  
  // Extract numeric parts from invoice numbers - only consider 4-digit or smaller numbers
  // This filters out old timestamp-based IDs like INV-1763623949631
  const numbers = invoices
    .map(inv => {
      const match = inv.invoiceNumber.match(/^\d{1,4}$/);
      return match ? parseInt(match[0], 10) : 0;
    })
    .filter(num => !isNaN(num) && num > 0);
  
  const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
  const nextNumber = maxNumber + 1;
  
  // Pad with zeros to make it 4 digits
  return nextNumber.toString().padStart(4, '0');
}

/**
 * Format invoice date to YYYY-MM-DD
 */
export function formatInvoiceDate(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Format currency value to 2 decimal places
 */
export function formatCurrency(value: number): string {
  return value.toFixed(2);
}

/**
 * Parse invoice number from various formats
 */
export function parseInvoiceNumber(invoiceNumber: string): number {
  const match = invoiceNumber.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}
