import type { FooterDetailsSectionProps } from '@/types/component.types';

const { ipcRenderer } = window.require('electron');

const FooterDetailsSection = ({ formData, onChange }: FooterDetailsSectionProps) => {
  const signatureUrl = formData.signatureImagePath || '';

  const handleSignatureSelect = async () => {
    const result = await ipcRenderer.invoke('select-logo');
    if (result.success && result.dataUrl) {
      onChange('signatureImagePath', result.dataUrl);
    }
  };

  const handleSignatureRemove = () => {
    onChange('signatureImagePath', '');
  };

  return (
    <section>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Clinic Tagline (Header)</label>
          <input
            type="text"
            value={formData.clinicTagline || ''}
            onChange={(e) => onChange('clinicTagline', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
            placeholder="e.g. Pain Relief • Rehab • Sports Injury"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Invoice Title</label>
          <input
            type="text"
            value={formData.title || ''}
            onChange={(e) => onChange('title', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
            placeholder="e.g. PHYSIOTHERAPY RECEIPT"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Footer Note Title</label>
            <input
              type="text"
              value={formData.footerNoteTitle || ''}
              onChange={(e) => onChange('footerNoteTitle', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
              placeholder="Note:"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Signature Label</label>
            <input
              type="text"
              value={formData.signatureLabel || ''}
              onChange={(e) => onChange('signatureLabel', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
              placeholder="Authorized Signatory"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Footer Notes (one line per note)</label>
          <textarea
            value={formData.footerNotes || ''}
            onChange={(e) => onChange('footerNotes', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all resize-y min-h-24"
            rows={4}
            placeholder="This is a professional physiotherapy treatment receipt for medical reimbursement.\nNo refund after treatment taken."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Signature Name (optional override)</label>
            <input
              type="text"
              value={formData.signatureName || ''}
              onChange={(e) => onChange('signatureName', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
              placeholder="e.g. Dr. Ajay Gupta"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Signature Qualification (optional override)</label>
            <input
              type="text"
              value={formData.signatureQualification || ''}
              onChange={(e) => onChange('signatureQualification', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
              placeholder="e.g. (BPT, MPT)"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Signature Image (optional)</label>
          <div className="flex items-center gap-4">
            <button
              onClick={handleSignatureSelect}
              className="px-4 py-2 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors font-medium text-sm"
            >
              Select Signature
            </button>
            {formData.signatureImagePath && (
              <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                <img src={signatureUrl} alt="Signature Preview" className="h-10 w-auto rounded object-contain" />
                <button
                  onClick={handleSignatureRemove}
                  className="text-sm text-red-600 hover:text-red-700 font-medium px-2"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FooterDetailsSection;
