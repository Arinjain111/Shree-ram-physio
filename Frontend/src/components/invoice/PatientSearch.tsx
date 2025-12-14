import { useState, useEffect, useRef } from 'react';
import { searchPatients as searchAlgo } from '@/utils/searchUtils';
import type { Patient } from '@/types/database.types';
import type { PatientSearchProps } from '@/types/component.types';

const PatientSearch = ({ invoices, onPatientSelect }: PatientSearchProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search patients using the robust search algorithm
  useEffect(() => {
    const performSearch = () => {

      if (searchQuery.trim().length < 1) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      setIsSearching(true);
      try {
        // Use the external search algorithm
        const results = searchAlgo(searchQuery, invoices);
				
        setSearchResults(results.slice(0, 10)); // Limit to 10 results
        setShowDropdown(results.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Error searching patients:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    // Debounce search slightly to avoid excessive updates on fast typing
    const timeoutId = setTimeout(performSearch, 150);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, invoices]);

  const handlePatientSelection = (patient: Patient) => {
    // Derive first/last name if we only have full name (older records)
    let finalFirstName = patient.firstName;
    let finalLastName = patient.lastName;
    const rawName = (patient.name || `${patient.firstName ?? ''} ${patient.lastName ?? ''}`).trim();
    if ((!finalFirstName || !finalLastName) && rawName) {
      const parts = rawName.split(/\s+/);
      finalFirstName = finalFirstName || parts[0] || '';
      finalLastName = finalLastName || (parts.length > 1 ? parts.slice(1).join(' ') : '');
    }

    // Normalize gender to match schema enum
    let normalizedGender: 'Male' | 'Female' | 'Other' = 'Other';
    const g = (patient.gender || '').toLowerCase();
    if (g === 'male') normalizedGender = 'Male';
    else if (g === 'female') normalizedGender = 'Female';

    onPatientSelect({
      firstName: finalFirstName || '',
      lastName: finalLastName || '',
      age: patient.age,
      gender: normalizedGender,
      phone: patient.phone || '',
      uhid: patient.uhid || '',
    });
    setSearchQuery('');
    setShowDropdown(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          handlePatientSelection(searchResults[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div ref={searchRef} className="relative">
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
          placeholder="Search by contact number or invoice number..."
          className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent sm:text-sm transition-shadow shadow-sm hover:shadow-md"
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSearchResults([]);
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </button>
        )}
        {isSearching && (
          <div className="absolute inset-y-0 right-10 flex items-center">
            <div className="animate-spin h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {/* Dropdown Results */}
      {showDropdown && searchResults.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden ring-1 ring-black ring-opacity-5">
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {searchResults.map((patient, index) => (
              <button
                key={patient.id}
                type="button"
                onClick={() => handlePatientSelection(patient)}
                onMouseDown={(e) => e.preventDefault()}
                className={`w-full px-4 py-3 text-left transition-colors flex items-center gap-3 ${
                  index === selectedIndex ? 'bg-purple-50' : 'hover:bg-gray-50'
                } border-b border-gray-50 last:border-none`}
              >
                <div className="flex shrink-0 h-10 w-10 rounded-full bg-purple-100 items-center justify-center text-purple-600 font-bold text-lg">
                  {(patient.firstName && patient.firstName[0]) || (patient.name && patient.name[0]) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {patient.firstName} {patient.lastName}
                    </p>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {patient.age} yrs • {patient.gender}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex items-center text-xs text-gray-500">
                      <svg className="flex shrink-0 mr-1.5 h-3.5 w-3.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                      </svg>
                      {patient.phone || 'N/A'}
                    </div>
                    <div className="flex items-center text-xs text-gray-500">
                      <svg className="flex shrink-0 mr-1.5 h-3.5 w-3.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      {patient.uhid}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No Results Message */}
      {showDropdown && searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 p-4 text-center">
          <p className="text-sm text-gray-500">No patients found matching "{searchQuery}"</p>
          <p className="text-xs text-gray-400 mt-1">Try searching by full phone number or invoice ID</p>
        </div>
      )}
    </div>
  );
};

export default PatientSearch;
