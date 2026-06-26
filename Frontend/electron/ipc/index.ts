import { registerInvoiceHandlers } from './invoices';
import { registerPatientHandlers } from './patients';
import { registerPresetHandlers } from './presets';
import { registerSettingsHandlers } from './settings';
import { registerPrintHandlers } from './print';
import { registerLayoutHandlers } from './layout';
import { registerSyncHandlers } from './sync';
import { registerClinicalHandlers } from './clinical';
import { registerInventoryHandlers } from './inventory';
import { registerExpenseHandlers } from './expenses';
import { registerSessionHandlers } from './sessions';
import { PrismaSyncEngine } from '../sync/prismaSyncEngine';

export function registerIpcHandlers(syncEngine: PrismaSyncEngine | null) {
    registerInvoiceHandlers();
    registerPatientHandlers();
    registerPresetHandlers();
    registerSettingsHandlers();
    registerPrintHandlers();
    registerLayoutHandlers();
    registerSyncHandlers(syncEngine);
    registerClinicalHandlers();
    registerInventoryHandlers();
    registerExpenseHandlers();
    registerSessionHandlers();
}
