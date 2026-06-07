import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { LayoutConfig } from '@/types/layout.types';
import { ipcRenderer } from '@/lib/ipc';
import { useLogger } from '@/utils/logger';

const defaultLayout: LayoutConfig = {
  clinicName: 'Shree Ram Physiotherapy & Rehabilitation Center',
  clinicTagline: '',
  clinicNameMaxWidth: 520,
  logoClinicNameSpacing: 20,
  clinicNameSingleLine: false,
  address: 'B-8, Mahesh Nagar, 80 Feet Road, Near Punjab National Bank, Jaipur, Rajasthan, 302015',
  uan: 'RJ17D009951',
  regNo: 'GAPT/21/G00281',
  logoPath: '',
  signatureImagePath: '',
  clinicPhone: '9783960050, 9214556934',
  clinicEmail: 'drajay_36hot@yahoo.co.in',
  doctorName: 'Ajay Gupta (PT)',
  doctorQualification: 'B.PT, M.PT',
  doctorMobile: '9783960050',
  headerAlign: 'left',
  logoPosition: 'left',
  headerLeftAlign: 'left',
  headerRightAlign: 'right',
  fontSize: 'medium',
  showBorder: true,
  logoArrangement: 'stack',
  rightBlockPosition: 'top',
  fontSizeValue: 23,
  metaFontSize: 15,
  logoMaxWidth: 160,
  logoMaxHeight: 113,
  headerBgColor: '#ffffff',
  headerTextColor: '#000000',
  headerPadding: 16,
  title: 'PHYSIOTHERAPY RECEIPT',
  titleBgColor: '#8764B6',
  titleTextColor: '#FFFFFF',
  sectionBgColor: '#F8F3FF',
  footerBgColor: '#F3F4F6',
  footerTextColor: '#000000',
  footerNoteTitle: 'Note:',
  footerNotes: 'This is a professional physiotherapy treatment receipt for medical reimbursement.\nNo refund after treatment taken.',
  signatureLabel: 'Authorized Signatory',
  signatureName: '',
  signatureQualification: '',
  paperSize: 'A4',
  paperOrientation: 'portrait',
};

interface LayoutContextValue {
  layout: LayoutConfig;
  loading: boolean;
  saveLayout: (newLayout: LayoutConfig) => Promise<boolean>;
  resetLayout: () => void;
  refreshLayout: () => Promise<void>;
}

const LayoutContext = createContext<LayoutContextValue | undefined>(undefined);

export const LayoutProvider = ({ children }: { children: ReactNode }) => {
  const [layout, setLayout] = useState<LayoutConfig>(defaultLayout);
  const [loading, setLoading] = useState(true);
  const log = useLogger();

  const loadLayout = useCallback(async () => {
    try {
      const result = await ipcRenderer.invoke('load-layout');
      if (result.success && result.layout) {
        setLayout({ ...defaultLayout, ...result.layout });
      }
    } catch (error) {
      log.error('layout', 'Error loading layout', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLayout();
  }, [loadLayout]);

  const saveLayout = useCallback(async (newLayout: LayoutConfig) => {
    try {
      const result = await ipcRenderer.invoke('save-layout', newLayout);
      if (result.success) {
        setLayout(newLayout);
        return true;
      }
      return false;
    } catch (error) {
      log.error('layout', 'Error saving layout', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(defaultLayout);
  }, []);

  const refreshLayout = useCallback(async () => {
    setLoading(true);
    await loadLayout();
  }, [loadLayout]);

  return (
    <LayoutContext.Provider value={{ layout, loading, saveLayout, resetLayout, refreshLayout }}>
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayoutContext = (): LayoutContextValue => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayoutContext must be used within a LayoutProvider');
  }
  return context;
};
