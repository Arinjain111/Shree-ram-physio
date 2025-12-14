import { useState, useEffect, useRef } from 'react';
import type { TreatmentPreset } from '@/types/treatmentPreset.types';
import type { TreatmentFormProps } from '@/types/component.types';

const { ipcRenderer } = window.require('electron');

const TreatmentForm = ({ 
  treatments, 
  updateTreatment, 
  removeTreatmentItem, 
  addTreatmentItem 
}: TreatmentFormProps) => {
  const [presets, setPresets] = useState<TreatmentPreset[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [filteredPresets, setFilteredPresets] = useState<TreatmentPreset[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    loadPresets();
    
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadPresets = async () => {
    try {
      const result = await ipcRenderer.invoke('load-treatment-presets');
      if (result.success) {
        setPresets(result.presets || []);
      }
    } catch (error) {
      console.error('Error loading treatment presets:', error);
    }
  };

  const handleTreatmentNameChange = (index: number, value: string) => {
    updateTreatment(index, 'name', value);
    
    // Filter presets based on input
    if (value.trim()) {
      const filtered = presets.filter(preset =>
        preset.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredPresets(filtered);
      setActiveDropdown(index);
      setSelectedIndex(0); // Reset selection to first item
    } else {
      setFilteredPresets([]);
      setActiveDropdown(null);
      setSelectedIndex(0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (activeDropdown !== index || filteredPresets.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < filteredPresets.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredPresets[selectedIndex]) {
          selectPreset(index, filteredPresets[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setActiveDropdown(null);
        setFilteredPresets([]);
        setSelectedIndex(0);
        break;
      case 'Tab':
        setActiveDropdown(null);
        break;
    }
  };

  // Helper function to add days to a date
  const addDays = (dateStr: string, days: number): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  // Helper function to calculate days between two dates
  const daysBetween = (startStr: string, endStr: string): number => {
    if (!startStr || !endStr) return 0;
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
  };

  const handleSessionsChange = (index: number, sessions: number) => {
    const treatment = treatments[index];
    updateTreatment(index, 'sessions', sessions);
    
    // If start date exists, calculate end date
    if (treatment.startDate && sessions > 0) {
      const endDate = addDays(treatment.startDate, sessions - 1);
      updateTreatment(index, 'endDate', endDate);
    }
    // If end date exists but no start date, calculate start date
    else if (treatment.endDate && sessions > 0 && !treatment.startDate) {
      const startDate = addDays(treatment.endDate, -(sessions - 1));
      updateTreatment(index, 'startDate', startDate);
    }
  };

  const handleStartDateChange = (index: number, startDate: string) => {
    const treatment = treatments[index];
    updateTreatment(index, 'startDate', startDate);
    
    // If sessions exist, calculate end date
    if (treatment.sessions > 0 && startDate) {
      const endDate = addDays(startDate, treatment.sessions - 1);
      updateTreatment(index, 'endDate', endDate);
    }
    // If end date exists, calculate sessions
    else if (treatment.endDate && startDate) {
      const sessions = daysBetween(startDate, treatment.endDate);
      updateTreatment(index, 'sessions', sessions);
    }
  };

  const handleEndDateChange = (index: number, endDate: string) => {
    const treatment = treatments[index];
    updateTreatment(index, 'endDate', endDate);
    
    // If start date exists, calculate sessions
    if (treatment.startDate && endDate) {
      const sessions = daysBetween(treatment.startDate, endDate);
      updateTreatment(index, 'sessions', sessions);
    }
    // If sessions exist but no start date, calculate start date
    else if (treatment.sessions > 0 && endDate && !treatment.startDate) {
      const startDate = addDays(endDate, -(treatment.sessions - 1));
      updateTreatment(index, 'startDate', startDate);
    }
  };

  const selectPreset = (index: number, preset: TreatmentPreset) => {
    updateTreatment(index, 'name', preset.name);
    updateTreatment(index, 'sessions', preset.defaultSessions);
    updateTreatment(index, 'amount', preset.pricePerSession);
    
    // Auto-calculate dates if start date exists
    const treatment = treatments[index];
    if (treatment.startDate) {
      const endDate = addDays(treatment.startDate, preset.defaultSessions - 1);
      updateTreatment(index, 'endDate', endDate);
    }
    
    setActiveDropdown(null);
    setFilteredPresets([]);
  };

  return (
    <section>
      <h3 className="text-lg font-semibold text-[#5F3794] mb-2">Treatment Details</h3>
      <div className="space-y-4">
        {treatments.map((treatment, index) => (
          <div key={`treatment-${index}`} className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3 relative" ref={activeDropdown === index ? dropdownRef : null}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type of Treatment/Service
                </label>
                <input
                  ref={el => inputRefs.current[index] = el}
                  type="text"
                  value={treatment.name}
                  onChange={(e) => handleTreatmentNameChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onFocus={() => {
                    if (treatment.name.trim()) {
                      const filtered = presets.filter(preset =>
                        preset.name.toLowerCase().includes(treatment.name.toLowerCase())
                      );
                      setFilteredPresets(filtered);
                      setActiveDropdown(index);
                      setSelectedIndex(0);
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
                  placeholder="Start typing to search treatments..."
                />
                
                {/* Autocomplete Dropdown */}
                {activeDropdown === index && filteredPresets.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-[300px] overflow-y-auto custom-scrollbar ring-1 ring-black ring-opacity-5">
                    {filteredPresets.map((preset, presetIndex) => (
                      <div
                        key={preset.id}
                        onMouseDown={() => selectPreset(index, preset)}
                        onMouseEnter={() => setSelectedIndex(presetIndex)}
                        className={`px-4 py-3 cursor-pointer border-b border-gray-50 last:border-b-0 transition-colors ${
                          presetIndex === selectedIndex 
                            ? 'bg-purple-50' 
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <div className={`font-medium text-sm ${presetIndex === selectedIndex ? 'text-purple-900' : 'text-gray-900'}`}>
                            {preset.name}
                          </div>
                          <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${presetIndex === selectedIndex ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                            ₹{preset.pricePerSession}/sess
                          </div>
                        </div>
                        <div className={`text-xs flex items-center gap-2 ${presetIndex === selectedIndex ? 'text-purple-600' : 'text-gray-500'}`}>
                          <span>{preset.defaultSessions} sessions</span>
                          <span className="w-1 h-1 rounded-full bg-current opacity-50"></span>
                          <span>Total: ₹{(preset.defaultSessions * preset.pricePerSession).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className='md:col-span-1'>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sessions (Number)
                </label>
                <input
                  type="number"
                  value={treatment.sessions === 0 ? '' : treatment.sessions}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleSessionsChange(index, val === '' ? 0 : parseInt(val));
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
                  placeholder="e.g., 10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={treatment.startDate}
                  onChange={(e) => handleStartDateChange(index, e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={treatment.endDate}
                  onChange={(e) => handleEndDateChange(index, e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount per session (₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g., 250"
                  value={treatment.amount === 0 ? '' : treatment.amount}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateTreatment(index, 'amount', val === '' ? 0 : parseFloat(val));
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
                />
              </div>
            </div>
            <div className="flex justify-end items-center mt-3">
              {treatments.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTreatmentItem(index)}
                  className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addTreatmentItem}
        className="mt-4 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
      >
        + Add Treatment Item
      </button>
    </section>
  );
};

export default TreatmentForm;
