import Fuse from 'fuse.js';
import { getPrismaClient } from '../database/prisma';
import { predictor } from './diagnosisNGram';

export type ClinicalCategory = 'diagnosis' | 'exercise';

export interface ClinicalRecord {
  id: number;
  name: string;
  category: ClinicalCategory;
  frequency: number;
}

const CATEGORIES: ClinicalCategory[] = ['diagnosis', 'exercise'];
const fuseInstances: Map<ClinicalCategory, Fuse<ClinicalRecord>> = new Map();
let shortcutsCache: Array<{ shortcut: string; expands: string }> = [];

function buildFuseIndex(presets: ClinicalRecord[]): Fuse<ClinicalRecord> {
  return new Fuse(presets, {
    keys: ['name'],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 1,
    shouldSort: false,
  });
}

export async function loadClinicalData(): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) return;

  const presets: ClinicalRecord[] = (await prisma.clinicalPreset.findMany({
    orderBy: { frequency: 'desc' },
  })).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category as ClinicalCategory,
    frequency: p.frequency,
  }));

  fuseInstances.clear();
  const ngramCorpus: string[] = [];
  for (const category of CATEGORIES) {
    const filtered = presets.filter(p => p.category === category);
    fuseInstances.set(category, buildFuseIndex(filtered));
    for (const p of filtered) ngramCorpus.push(p.name);
  }
  predictor.build(ngramCorpus);

  shortcutsCache = await prisma.diagnosisShortcut.findMany();
}

export async function reloadClinicalData(): Promise<void> {
  fuseInstances.clear();
  await loadClinicalData();
}

export function searchClinical(category: ClinicalCategory, query: string, limit: number = 20): ClinicalRecord[] {
  const fuse = fuseInstances.get(category);
  if (!fuse) return [];

  const trimmed = query.trim();
  if (!trimmed) return [];

  const results = fuse.search(trimmed, { limit });

  const scored = results.map(r => ({
    ...r.item,
    score: (r.score ?? 1) - Math.min(r.item.frequency / 100, 0.3),
  }));

  scored.sort((a, b) => a.score - b.score);

  return scored.slice(0, limit);
}

export function resolveShortcuts(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  for (const s of shortcutsCache) {
    if (s.shortcut.toLowerCase() === trimmed) {
      return s.expands;
    }
  }
  return null;
}

export function getRecentClinical(category: ClinicalCategory, limit: number = 10): ClinicalRecord[] {
  const fuse = fuseInstances.get(category);
  if (!fuse) return [];
  const all = (fuse as any)._docs as ClinicalRecord[];
  return [...all].sort((a, b) => b.frequency - a.frequency).slice(0, limit);
}

export async function incrementClinicalFrequency(category: ClinicalCategory, name: string): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) return;

  const existing = await prisma.clinicalPreset.findFirst({ where: { name, category } });

  if (existing) {
    await prisma.clinicalPreset.update({
      where: { id: existing.id },
      data: { frequency: { increment: 1 }, syncStatus: 'PENDING' },
    });
  } else {
    await prisma.clinicalPreset.create({
      data: { name, category, frequency: 1, syncStatus: 'PENDING' },
    });
  }

  await reloadClinicalData();
}

export async function addCustomClinical(category: ClinicalCategory, name: string): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) return;

  const existing = await prisma.clinicalPreset.findFirst({ where: { name, category } });
  if (!existing) {
    await prisma.clinicalPreset.create({
      data: { name, category, frequency: 0, syncStatus: 'PENDING' },
    });
  }

  await reloadClinicalData();
}
