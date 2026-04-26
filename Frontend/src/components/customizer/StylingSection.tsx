import type { ColorCircleProps, StylingSectionProps } from '@/types/component.types';

const ColorCircle = ({ label, value, onChange }: ColorCircleProps) => {
  const displayValue = value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : '#ffffff';
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        {/* Visible circular swatch */}
        <div
          className="w-10 h-10 rounded-full shadow-sm border border-slate-200"
          style={{ backgroundColor: displayValue }}
        />
        {/* Invisible native color input covering the swatch */}
        <input
          type="color"
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-10 h-10 opacity-0 cursor-pointer"
          aria-label={label}
        />
      </div>
    </div>
  );
};

const StylingSection = ({ formData, onChange }: StylingSectionProps) => {
  const currentPaper = formData.paperSize || 'A4';
  const currentOrientation = formData.paperOrientation || 'portrait';

  // Paper option thumbnails — proportional aspect ratios
  const paperOptions: { size: 'A4' | 'A5'; orientation: 'portrait' | 'landscape'; label: string; w: number; h: number; desc: string }[] = [
    { size: 'A4', orientation: 'portrait',  label: 'A4 Portrait',  w: 48, h: 68, desc: '210 × 297 mm' },
    { size: 'A5', orientation: 'portrait',  label: 'A5 Portrait',  w: 40, h: 56, desc: '148 × 210 mm' },
  ];

  return (
    <section className="">
      {/* Paper Size & Orientation */}
      <div className="space-y-8">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Paper Size & Orientation</label>
          <p className="text-xs text-slate-500 mb-4">Choose the paper format for printed invoices and PDF exports.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {paperOptions.map((opt) => {
              const isActive = currentPaper === opt.size && currentOrientation === opt.orientation;
              return (
                <button
                  key={`${opt.size}-${opt.orientation}`}
                  type="button"
                  onClick={() => {
                    onChange('paperSize', opt.size);
                    onChange('paperOrientation', opt.orientation);
                  }}
                  className={`group relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-500 ring-offset-2 shadow-md'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm'
                  }`}
                >
                  {/* Paper thumbnail */}
                  <div
                    className={`rounded-sm border-2 transition-colors ${
                      isActive 
                        ? 'border-teal-400 bg-white' 
                        : 'border-slate-300 bg-slate-50 group-hover:border-slate-400'
                    }`}
                    style={{ width: opt.w, height: opt.h }}
                  >
                    {/* Mini content lines inside the paper */}
                    <div className="flex flex-col items-center justify-center h-full gap-1 p-1.5">
                      <div className={`h-0.5 rounded-full ${isActive ? 'bg-teal-300' : 'bg-slate-300'}`} style={{ width: '70%' }} />
                      <div className={`h-0.5 rounded-full ${isActive ? 'bg-teal-200' : 'bg-slate-200'}`} style={{ width: '50%' }} />
                      <div className={`h-0.5 rounded-full ${isActive ? 'bg-teal-200' : 'bg-slate-200'}`} style={{ width: '60%' }} />
                      <div className={`h-0.5 rounded-full ${isActive ? 'bg-teal-200' : 'bg-slate-200'}`} style={{ width: '40%' }} />
                    </div>
                  </div>
                  {/* Label */}
                  <div className="text-center">
                    <span className={`block text-xs font-semibold ${isActive ? 'text-teal-700' : 'text-slate-700'}`}>
                      {opt.label}
                    </span>
                    <span className={`block text-[10px] ${isActive ? 'text-teal-500' : 'text-slate-400'}`}>
                      {opt.desc}
                    </span>
                  </div>
                  {/* Active checkmark */}
                  {isActive && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <h4 className="text-sm font-semibold text-slate-800 mb-4 uppercase tracking-wider">Alignment</h4>
        {/* Header Alignment Controls */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">Left Section Alignment (Logo & Clinic Name)</label>
          <div className="flex gap-3">
            {['left', 'center', 'right'].map((align) => (
              <button
                key={align}
                type="button"
                onClick={() => onChange('headerLeftAlign', align)}
                className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  formData.headerLeftAlign === align
                    ? 'bg-teal-600 text-white shadow-md ring-2 ring-teal-600 ring-offset-2'
                    : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 hover:border-slate-400'
                }`}
              >
                {align.charAt(0).toUpperCase() + align.slice(1)}
              </button>
            ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">Right Section Alignment (UAN & Reg No.)</label>
            <div className="flex gap-3">
              {['left', 'center', 'right'].map((align) => (
                <button
                  key={align}
                  type="button"
                  onClick={() => onChange('headerRightAlign', align)}
                  className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
                    formData.headerRightAlign === align
                      ? 'bg-teal-600 text-white shadow-md ring-2 ring-teal-600 ring-offset-2'
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 hover:border-slate-400'
                  }`}
                >
                  {align.charAt(0).toUpperCase() + align.slice(1)}
                </button>
              ))}
            </div>
          </div>

        {/* Logo Arrangement */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">Logo & Clinic Name Layout</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onChange('logoArrangement', 'stack')}
              className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
                formData.logoArrangement === 'stack'
                  ? 'bg-teal-600 text-white shadow-md ring-2 ring-teal-600 ring-offset-2'
                  : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 hover:border-slate-400'
              }`}
            >
              Stack (Name Below Logo)
            </button>
            <button
              type="button"
              onClick={() => onChange('logoArrangement', 'inline')}
              className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
                formData.logoArrangement === 'inline'
                  ? 'bg-teal-600 text-white shadow-md ring-2 ring-teal-600 ring-offset-2'
                  : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 hover:border-slate-400'
              }`}
            >
              Inline (Side by Side)
            </button>
          </div>
        </div>

        </div>

        <div className="border-t border-slate-100 pt-6">
          <h4 className="text-sm font-semibold text-slate-800 mb-4 uppercase tracking-wider">Colors</h4>
          {/* Color Pickers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <ColorCircle
              label="Title BG"
              value={formData.titleBgColor}
              onChange={(v) => onChange('titleBgColor', v)}
            />
            <ColorCircle
              label="Section BG"
              value={formData.sectionBgColor}
              onChange={(v) => onChange('sectionBgColor', v)}
            />
            <ColorCircle
              label="Header BG"
              value={formData.headerBgColor}
              onChange={(v) => onChange('headerBgColor', v)}
            />
            <ColorCircle
              label="Header Text"
              value={formData.headerTextColor}
              onChange={(v) => onChange('headerTextColor', v)}
            />
            <ColorCircle
              label="Footer BG"
              value={formData.footerBgColor}
              onChange={(v) => onChange('footerBgColor', v)}
            />
            <ColorCircle
              label="Footer Text"
              value={formData.footerTextColor}
              onChange={(v) => onChange('footerTextColor', v)}
            />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <h4 className="text-sm font-semibold text-slate-800 mb-4 uppercase tracking-wider">Typography & Sizing</h4>
          {/* Font Size Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Clinic Name Font Size</label>
              <input
                type="number"
                min="16"
                max="48"
                value={formData.fontSizeValue}
                onChange={(e) => onChange('fontSizeValue', parseInt(e.target.value) || 16)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                placeholder="e.g., 20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Meta Info Font Size</label>
              <input
                type="number"
                min="8"
                max="16"
                value={formData.metaFontSize}
                onChange={(e) => onChange('metaFontSize', parseInt(e.target.value) || 8)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                placeholder="e.g., 12"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Clinic Name Max Width (px)</label>
              <input
                type="number"
                min="120"
                max="800"
                value={formData.clinicNameMaxWidth ?? 300}
                onChange={(e) => onChange('clinicNameMaxWidth', parseInt(e.target.value) || 300)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                placeholder="e.g., 300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Logo ↔ Clinic Name Spacing (px)</label>
              <input
                type="number"
                min="0"
                max="80"
                value={formData.logoClinicNameSpacing ?? 20}
                onChange={(e) => onChange('logoClinicNameSpacing', parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                placeholder="e.g., 20"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-3">Clinic Name Line Break</label>
              <div className="flex gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => onChange('clinicNameSingleLine', false)}
                  className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
                    (formData.clinicNameSingleLine !== true)
                      ? 'bg-teal-600 text-white shadow-md ring-2 ring-teal-600 ring-offset-2'
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 hover:border-slate-400'
                  }`}
                >
                  Auto Wrap (Default)
                </button>
                <button
                  type="button"
                  onClick={() => onChange('clinicNameSingleLine', true)}
                  className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
                    (formData.clinicNameSingleLine === true)
                      ? 'bg-teal-600 text-white shadow-md ring-2 ring-teal-600 ring-offset-2'
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 hover:border-slate-400'
                  }`}
                >
                  Force Single Line (…)
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Auto wrap keeps it on one line if it fits, otherwise wraps without cutting off. Force single line truncates with “…” if needed.
              </p>
            </div>
          </div>

          {/* Logo Size Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Logo Max Width</label>
              <input
                type="number"
                min="50"
                max="250"
                value={formData.logoMaxWidth}
                onChange={(e) => onChange('logoMaxWidth', parseInt(e.target.value) || 50)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                placeholder="e.g., 120"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Logo Max Height</label>
              <input
                type="number"
                min="50"
                max="150"
                value={formData.logoMaxHeight}
                onChange={(e) => onChange('logoMaxHeight', parseInt(e.target.value) || 50)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                placeholder="e.g., 80"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StylingSection;
