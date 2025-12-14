import { useState } from 'react';
import { useInvoiceLayout, LayoutConfig } from '@/hooks/useInvoiceLayout';
import { useUI } from '@/context/UIContext';
import PageHeader from '@/components/layout/PageHeader';
import HeaderDetailsSection from '@/components/customizer/HeaderDetailsSection';
import StylingSection from '@/components/customizer/StylingSection';
import PreviewPanel from '@/components/customizer/PreviewPanel';
import { SaveIcon, RotateCcwIcon, LayoutIcon } from '@/components/icons';

const InvoiceCustomizer = () => {
  const { showToast, showModal } = useUI();
  const { layout: savedLayout, saveLayout, resetLayout } = useInvoiceLayout();
  
  const [formData, setFormData] = useState<LayoutConfig>(savedLayout);

  const handleChange = (field: keyof LayoutConfig, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSave = async () => {
    const success = await saveLayout(formData);
    if (success) {
      showToast('success', 'Layout saved successfully!');
    } else {
      showToast('error', 'Failed to save layout');
    }
  };

  const handleReset = () => {
    showModal({
      title: 'Reset Layout',
      message: 'Are you sure you want to reset to default layout?',
      type: 'warning',
      confirmText: 'Reset',
      onConfirm: () => {
        resetLayout();
        window.location.reload();
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-[1600px] mx-auto">
        {/* Header Section */}
        <PageHeader 
          title="Invoice Customizer"
          icon={
            <div className="p-2 bg-teal-100 text-teal-700 rounded-lg">
              <LayoutIcon />
            </div>
          }
          description={
            <p className="text-slate-500 text-sm">
              Customize your invoice template, header details, and branding.
            </p>
          }
          actions={
            <>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg font-medium shadow-sm transition-colors text-sm"
              >
                <RotateCcwIcon />
                Reset Default
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium shadow-sm transition-colors text-sm"
              >
                <SaveIcon />
                Save Layout
              </button>
            </>
          }
        />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* Settings Panel */}
          <div className="xl:col-span-7 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  Header & Clinic Details
                </h2>
              </div>
              <div className="p-6">
                <HeaderDetailsSection formData={formData} onChange={handleChange} />
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  Styling & Layout
                </h2>
              </div>
              <div className="p-6">
                <StylingSection formData={formData} onChange={handleChange} />
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="xl:col-span-5 xl:sticky xl:top-6">
            <div className="bg-slate-200/50 rounded-xl border border-slate-200 p-4 backdrop-blur-sm">
              <PreviewPanel formData={formData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceCustomizer;
