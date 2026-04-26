import { useCallback } from 'react';

import { useInvoiceLayout } from './useInvoiceLayout';
import { generateInvoiceHTML } from '@/utils/invoiceGenerator';
import { useErrorHandler } from './useErrorHandler';
import type { InvoiceData } from '@/schemas/validation.schema';

const { ipcRenderer } = window.require('electron');

export const useInvoicePrinter = () => {

    const { layout } = useInvoiceLayout();
    const { handleError } = useErrorHandler();

    const printInvoice = useCallback(async (invoiceData: InvoiceData) => {
        try {
            // 1. Generate HTML
            const printContent = generateInvoiceHTML(invoiceData, layout);

            // 2. Invoke Electron Print (pass paper config for OS dialog)
            const paperConfig = {
                paperSize: layout.paperSize || 'A4',
                paperOrientation: layout.paperOrientation || 'portrait',
            };
            const result = await ipcRenderer.invoke('print-invoice-save-and-preview', printContent, invoiceData, paperConfig);

            if (!result.success) {
                throw new Error(result.error || 'Print failed');
            }

            return true;
        } catch (error) {
            handleError(error, 'Failed to generate invoice for printing');
            return false;
        }
    }, [layout, handleError]);

    const previewInvoice = useCallback(async (invoiceData: InvoiceData) => {
        try {
            const printContent = generateInvoiceHTML(invoiceData, layout);
            const paperConfig = {
                paperSize: layout.paperSize || 'A4',
                paperOrientation: layout.paperOrientation || 'portrait',
            };
            const result = await ipcRenderer.invoke('preview-only', printContent, paperConfig);

            if (!result.success) {
                throw new Error(result.error || 'Preview failed');
            }

            return true;
        } catch (error) {
            handleError(error, 'Failed to generate preview');
            return false;
        }
    }, [layout, handleError]);

    return { printInvoice, previewInvoice };
};
