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
  return (
    <section className="">
      {/* <h3 className="text-xl font-semibold text-slate-800 mb-2">Layout & Styling</h3> */}
      <div className="space-y-8">
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
