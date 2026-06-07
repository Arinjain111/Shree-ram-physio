import React, { useState } from 'react';

export interface SelectOption {
  value: string | number;
  label: React.ReactNode;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: string | number) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  themeColor?: 'indigo' | 'teal';
  size?: 'sm' | 'md';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = '',
  themeColor = 'indigo',
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value);

  const themeRing = themeColor === 'teal' ? 'focus:ring-teal-500/50 focus:border-teal-500' : 'focus:ring-indigo-500/50 focus:border-indigo-500';
  const themeBg = themeColor === 'teal' ? 'bg-teal-50 text-teal-700' : 'bg-indigo-50 text-indigo-700';

  const buttonPadding = size === 'sm' ? 'px-2 py-1.5' : 'px-4 py-2.5';
  const buttonTextSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const buttonRounded = size === 'sm' ? 'rounded-lg' : 'rounded-xl';

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between ${buttonPadding} bg-slate-50 border border-slate-200 ${buttonRounded} ${buttonTextSize} font-medium text-slate-800 transition-all outline-none shadow-sm focus:ring-2 ${themeRing} ${isOpen ? `ring-2 ${themeRing}` : ''}`}
      >
        <span className={selectedOption ? '' : 'text-slate-400'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-lg py-2 max-h-60 overflow-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                  option.disabled ? 'text-slate-300 cursor-not-allowed' : 
                  value === option.value ? `${themeBg} font-semibold` : 'text-slate-600 hover:bg-slate-50 font-medium hover:text-slate-900'
                }`}
              >
                {option.label}
                {value === option.value && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
