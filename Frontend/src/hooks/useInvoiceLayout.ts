import { useState, useEffect } from 'react';
import type { LayoutConfig } from '@/types/layout.types';

const { ipcRenderer } = window.require('electron');

export type { LayoutConfig };

const defaultLayout: LayoutConfig = {
  clinicName: 'Shree Ram Physiotherapy & Rehabilitation Center',
  clinicTagline: '',
  clinicNameMaxWidth: 520,
  logoClinicNameSpacing: 20,
  clinicNameSingleLine: false,
  address: 'B-8, Mahesh Nagar, 80 Feet Road, Near Punjab National Bank, Jaipur, Rajasthan, 302015',
  uan: 'RJ17D0099951',
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
  title: 'PHYSIOTHERAPY RECIEPT',
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
};

export const useInvoiceLayout = () => {
  const [layout, setLayout] = useState<LayoutConfig>(defaultLayout);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLayout();
  }, []);

  const loadLayout = async () => {
    try {
      const result = await ipcRenderer.invoke('load-layout');
      if (result.success && result.layout) {
        setLayout({ ...defaultLayout, ...result.layout });
      }
    } catch (error) {
      console.error('Error loading layout:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveLayout = async (newLayout: LayoutConfig) => {
    try {
      const result = await ipcRenderer.invoke('save-layout', newLayout);
      if (result.success) {
        setLayout(newLayout);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error saving layout:', error);
      return false;
    }
  };

  const resetLayout = () => {
    setLayout(defaultLayout);
  };

  return { layout, loading, saveLayout, resetLayout };
};
