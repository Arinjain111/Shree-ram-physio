import Fuse from 'fuse.js';
import { getPrismaClient } from '../database/prisma';
import { predictor } from './diagnosisNGram';

interface DiagnosisRecord {
  id: number;
  name: string;
  frequency: number;
}

interface ShortcutRecord {
  shortcut: string;
  expands: string;
}

let fuseInstance: Fuse<DiagnosisRecord> | null = null;
let shortcutsCache: ShortcutRecord[] = [];

function buildFuseIndex(presets: DiagnosisRecord[]): Fuse<DiagnosisRecord> {
  return new Fuse(presets, {
    keys: ['name'],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 1,
    shouldSort: false,
  });
}

export async function loadDiagnosisData(): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) return;

  const presets: DiagnosisRecord[] = await prisma.diagnosisPreset.findMany({
    orderBy: { frequency: 'desc' },
  });
  fuseInstance = buildFuseIndex(presets);
  predictor.build(presets.map(p => p.name));

  const shortcuts: ShortcutRecord[] = await prisma.diagnosisShortcut.findMany();
  shortcutsCache = shortcuts;
}

export async function reloadDiagnosisData(): Promise<void> {
  fuseInstance = null;
  shortcutsCache = [];
  await loadDiagnosisData();
}

export function searchDiagnoses(query: string, limit: number = 20): DiagnosisRecord[] {
  if (!fuseInstance) return [];

  const trimmed = query.trim();
  if (!trimmed) return [];

  const results = fuseInstance.search(trimmed, { limit });

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

export function getRecentDiagnoses(limit: number = 10): DiagnosisRecord[] {
  if (!fuseInstance) return [];
  const all = (fuseInstance as any)._docs as DiagnosisRecord[];
  return [...all].sort((a, b) => b.frequency - a.frequency).slice(0, limit);
}

export async function incrementDiagnosisFrequency(name: string): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) return;

  const existing = await prisma.diagnosisPreset.findFirst({ where: { name } });

  if (existing) {
    await prisma.diagnosisPreset.update({
      where: { id: existing.id },
      data: { frequency: { increment: 1 }, syncStatus: 'PENDING' },
    });
  } else {
    await prisma.diagnosisPreset.create({
      data: { name, frequency: 1, syncStatus: 'PENDING' },
    });
  }

  await reloadDiagnosisData();
}

export async function addCustomDiagnosis(name: string): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) return;

  const existing = await prisma.diagnosisPreset.findFirst({ where: { name } });
  if (!existing) {
    await prisma.diagnosisPreset.create({
      data: { name, frequency: 0, syncStatus: 'PENDING' },
    });
  }

  await reloadDiagnosisData();
}
