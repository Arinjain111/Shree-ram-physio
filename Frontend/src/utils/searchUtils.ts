/**
 * Search Utilities
 * Robust search algorithm for finding patients within a list of invoices
 */

import type { Patient, SearchInvoice as Invoice } from '@/types/database.types';

export type { Patient, Invoice };

/**
 * Robust search algorithm for finding patients within a list of invoices.
 * Searches across:
 * - Patient Name (First & Last)
 * - Phone Number
 * - UHID
 * - Invoice Numbers associated with the patient
 * 
 * @param query The search string
 * @param invoices List of all invoices containing patient data
 * @returns Sorted list of unique matching patients
 */
export const searchPatients = (query: string, invoices: Invoice[]): Patient[] => {

  if (!query || query.trim().length < 1) {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();
  const queryParts = normalizedQuery.split(/\s+/); // Split by whitespace for multi-word search

  // 1. Extract unique patients and map them to their invoices for quick lookup
  // Since records from the local DB may not have IDs, we build a synthetic key
  // from stable identifying fields (name + phone + uhid).
  const patientMap = new Map<string, { patient: Patient; invoiceNumbers: string[] }>();

  invoices?.forEach((inv, index) => {
    if (!inv || !inv.patient) return;

    const p = inv.patient;
    const rawName = (p.name || `${p.firstName ?? ''} ${p.lastName ?? ''}`).trim();
    const keyBase = `${rawName}|${p.phone ?? ''}|${p.uhid ?? ''}`.toLowerCase();
    const key = keyBase || `idx-${index}`;

    if (!patientMap.has(key)) {
      patientMap.set(key, { patient: p, invoiceNumbers: [] });
    }
    patientMap.get(key)!.invoiceNumbers.push(inv.invoiceNumber.toLowerCase());
  });

  const allPatients = Array.from(patientMap.values());
  const matchedPatients: Patient[] = [];

  allPatients.forEach(({ patient, invoiceNumbers }) => {
    // Derive first/last name from full name when missing (older records)
    const rawName = (patient.name || `${patient.firstName ?? ''} ${patient.lastName ?? ''}`).trim();
    let derivedFirst = patient.firstName;
    let derivedLast = patient.lastName;

    if ((!derivedFirst || !derivedLast) && rawName) {
      const parts = rawName.split(/\s+/);
      derivedFirst = derivedFirst || parts[0] || '';
      derivedLast = derivedLast || (parts.length > 1 ? parts.slice(1).join(' ') : '');
    }

    const firstName = (derivedFirst || '').toLowerCase();
    const lastName = (derivedLast || '').toLowerCase();
    const fullName = (rawName || `${firstName} ${lastName}`).toLowerCase();
    const phone = (patient.phone || '').toLowerCase();
    const uhid = (patient.uhid || '').toLowerCase();

    // Scoring system
    let score = 0;

    // Check against all query parts (e.g. "John Doe" -> check "john" and "doe")
    // For a match, ALL parts must be found in at least one of the fields (AND logic for words)
    // OR we can do OR logic. Usually for name search "John Doe", we expect both.
    
    const allPartsMatch = queryParts.every(part => {
      let partFound = false;

      // Name Match
      if (firstName.includes(part) || lastName.includes(part) || fullName.includes(part)) {
        partFound = true;
        score += 10;
        if (firstName === part || lastName === part) score += 5; // Exact word match bonus
      }

      // Phone Match
      if (phone.includes(part)) {
        partFound = true;
        score += 15; // Higher priority for phone
        if (phone === part) score += 10;
      }

      // UHID Match
      if (uhid.includes(part)) {
        partFound = true;
        score += 20; // High priority for ID
      }

      // Invoice Number Match
      if (invoiceNumbers.some(invNum => invNum.includes(part))) {
        partFound = true;
        score += 15;
      }

      return partFound;
    });

    if (allPartsMatch) {
      matchedPatients.push({
        ...patient,
        firstName: derivedFirst || '',
        lastName: derivedLast || '',
        name: rawName || `${derivedFirst ?? ''} ${derivedLast ?? ''}`.trim(),
        _score: score,
      } as any);
    }
  });

  // Sort results by relevance score (descending)
  return matchedPatients.sort((a: any, b: any) => {
    if (b._score !== a._score) {
      return b._score - a._score;
    }
    // Tie‑breaker: alphabetical by name
    return (a.name || '').localeCompare(b.name || '');
  });
};

/**
 * Normalize a string for comparison
 */
export function normalizeSearchString(str: string): string {
  return str.toLowerCase().trim();
}

/**
 * Check if a string matches a query
 */
export function matchesQuery(text: string, query: string): boolean {
  return normalizeSearchString(text).includes(normalizeSearchString(query));
}
