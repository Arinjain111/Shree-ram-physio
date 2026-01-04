import { registerInvoiceHandlers } from './invoices';
import { registerPatientHandlers } from './patients';
import { registerPresetHandlers } from './presets';
import { registerSettingsHandlers } from './settings';
import { registerPrintHandlers } from './print';
import { registerLayoutHandlers } from './layout';
import { registerSyncHandlers } from './sync';
import { PrismaSyncEngine } from '../sync/prismaSyncEngine';

export function registerIpcHandlers(syncEngine: PrismaSyncEngine | null) {
    registerInvoiceHandlers();
    registerPatientHandlers();
    registerPresetHandlers();
    registerSettingsHandlers();
    registerPrintHandlers();
    registerLayoutHandlers();
    registerSyncHandlers(syncEngine);
}
