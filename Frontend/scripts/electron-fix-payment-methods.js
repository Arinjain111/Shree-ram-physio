const { app } = require('electron');
const path = require('path');

const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

app.setName('shri-ram-physio-invoicing');

function normalizePaymentMethod(value) {
  if (typeof value !== 'string') return 'Cash';
  const v = value.trim().toLowerCase();
  if (!v) return 'Cash';
  if (v === 'cash') return 'Cash';
  if (v === 'card' || v === 'debit' || v === 'credit') return 'Card';
  if (v === 'upi') return 'UPI';
  if (v === 'online' || v === 'netbanking' || v === 'bank') return 'Online';
  if (v === 'cheque' || v === 'check') return 'Cheque';
  return 'Cash';
}

async function main() {
  await app.whenReady();

  const dbPath = path.join(app.getPath('userData'), 'shri-ram-physio.db');
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  const prisma = new PrismaClient({ adapter });

  try {
    const invoices = await prisma.invoice.findMany({ select: { id: true, paymentMethod: true } });
    let updated = 0;

    for (const inv of invoices) {
      const normalized = normalizePaymentMethod(inv.paymentMethod);
      if (inv.paymentMethod !== normalized) {
        await prisma.invoice.update({ where: { id: inv.id }, data: { paymentMethod: normalized } });
        updated++;
      }
    }

    console.log('dbPath:', dbPath);
    console.log('invoices checked:', invoices.length);
    console.log('invoices updated:', updated);
  } finally {
    await prisma.$disconnect();
    setTimeout(() => app.exit(0), 50);
  }
}

main().catch((e) => {
  console.error(e);
  setTimeout(() => app.exit(1), 50);
});
