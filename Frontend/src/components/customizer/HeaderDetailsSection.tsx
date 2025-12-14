// import { LayoutConfig } from '@/hooks/useInvoiceLayout';
import type { HeaderDetailsSectionProps } from '@/types/component.types';

const { ipcRenderer } = window.require('electron');

const HeaderDetailsSection = ({ formData, onChange }: HeaderDetailsSectionProps) => {
  const logoUrl = formData.logoPath || '';
  
  const handleLogoSelect = async () => {
    const result = await ipcRenderer.invoke('select-logo');
    if (result.success && result.dataUrl) {
      onChange('logoPath', result.dataUrl);
    }
  };

  const handleLogoRemove = () => {
    onChange('logoPath', '');
  };

  return (
    <section className="">
      {/* <h3 className="text-lg font-semibold text-[#5F3794] mb-2">Header and Footer Details</h3> */}
      <div className="space-y-5">
        {/* Clinic Info */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Clinic Name</label>
          <input
            type="text"
            value={formData.clinicName}
            onChange={(e) => onChange('clinicName', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
            placeholder="e.g. Shree Ram Physiotherapy and Rehabilitation Center"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Address (Footer)</label>
          <textarea
            value={formData.address}
            onChange={(e) => onChange('address', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all resize-y min-h-20"
            rows={3}
            placeholder="Clinic address..."
          />
        </div>
        <div className='flex flex-col sm:flex-row w-full gap-5'>
          <div className='w-full'>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">UAN</label>
            <input
              type="text"
              value={formData.uan}
              onChange={(e) => onChange('uan', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
              placeholder="Optional"
            />
          </div>
          <div className='w-full'>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Registration Number</label>
            <input
              type="text"
              value={formData.regNo}
              onChange={(e) => onChange('regNo', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
              placeholder="Optional"
            />
          </div>
        </div>
        
        <div className='flex flex-col sm:flex-row w-full gap-5'>
          <div className='w-full'>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Contact Number (Footer)</label>
            <input
              type="text"
              value={formData.clinicPhone}
              onChange={(e) => onChange('clinicPhone', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
              placeholder="e.g., 9123456789, 9876543210"
            />
          </div>
          <div className='w-full'>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email (Footer)</label>
            <input
              type="email"
              value={formData.clinicEmail}
              onChange={(e) => onChange('clinicEmail', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
              placeholder="e.g., clinic@example.com"
            />
          </div>
        </div>

        {/* Logo Uploader */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Clinic Logo</label>
          <div className="flex items-center gap-4">
            <button
              onClick={handleLogoSelect}
              className="px-4 py-2 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors font-medium text-sm"
            >
              Select Logo
            </button>
            {formData.logoPath && (
              <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                <img src={logoUrl} alt="Logo Preview" className="h-10 w-auto rounded object-contain" />
                <button
                  onClick={handleLogoRemove}
                  className="text-sm text-red-600 hover:text-red-700 font-medium px-2"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
          {formData.logoPath && (
            <p className="text-xs text-slate-400 mt-2 truncate max-w-md">
              Current: {formData.logoPath}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default HeaderDetailsSection;