import { useState, useEffect } from 'react';
import { useLayoutContext } from '@/context/LayoutContext';
import type { LayoutConfig } from '@/types/layout.types';
import { useUI } from '@/context/UIContext';
import PageHeader from '@/components/layout/PageHeader';
import HeaderDetailsSection from '@/components/customizer/HeaderDetailsSection';
import FooterDetailsSection from '@/components/customizer/FooterDetailsSection';
import StylingSection from '@/components/customizer/StylingSection';
import PreviewPanel from '@/components/customizer/PreviewPanel';
import { SaveIcon, RotateCcwIcon, LayoutIcon } from '@/components/icons';

const InvoiceCustomizer = () => {
  const { showToast, showModal } = useUI();
  const { layout: savedLayout, loading: layoutLoading, saveLayout, resetLayout } = useLayoutContext();
  
  const [formData, setFormData] = useState<LayoutConfig>(savedLayout);

  // Sync local form state when the async layout finishes loading
  useEffect(() => {
    if (!layoutLoading) {
      setFormData(savedLayout);
    }
  }, [savedLayout, layoutLoading]);

  const handleChange = (field: keyof LayoutConfig, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
    <div className="w-full max-w-full min-h-screen bg-slate-50/50 px-4 sm:px-6 py-8 mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-full mx-auto pb-6">
        {/* Header Section */}
        <PageHeader 
          breadcrumb="Billing"
          title="Invoice Customizer"
          icon={
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <LayoutIcon />
            </div>
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
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-sm transition-all transform active:scale-95 text-sm"
              >
                <SaveIcon />
                Save Layout
              </button>
            </>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Settings Panel */}
          <div className="lg:col-span-3 space-y-6">
            <section className="bg-white border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  Header & Clinic Details
                </h2>
              </div>
              <div className="p-6">
                <HeaderDetailsSection formData={formData} onChange={handleChange} />
              </div>
            </section>

            <section className="bg-white border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  Footer & Signature
                </h2>
              </div>
              <div className="p-6">
                <FooterDetailsSection formData={formData} onChange={handleChange} />
              </div>
            </section>
            
            <section className="bg-white border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  Styling & Layout
                </h2>
              </div>
              <div className="p-6">
                <StylingSection formData={formData} onChange={handleChange} />
              </div>
            </section>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-2 relative">
            <div className="sticky top-6">
              <div className="bg-slate-200/80 rounded-2xl border border-slate-300/80 shadow-inner overflow-hidden p-4 h-[calc(100vh-8rem)] flex flex-col">
                <PreviewPanel formData={formData} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceCustomizer;
