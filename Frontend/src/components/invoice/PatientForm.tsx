import { useState } from 'react';
import { PatientFormSchema } from '@/schemas/validation.schema.ts';
import type { PatientFormProps } from '@/types/component.types';

const PatientForm = ({ patient, setPatient }: PatientFormProps) => {
  const [firstNameErrors, setFirstNameErrors] = useState<string[]>([]);
  const [lastNameErrors, setLastNameErrors] = useState<string[]>([]);
  const [ageErrors, setAgeErrors] = useState<string[]>([]);
  const [phoneErrors, setPhoneErrors] = useState<string[]>([]);
  const [uhidErrors, setUhidErrors] = useState<string[]>([]);
  const [uhidFieldEnabled, setUhidFieldEnabled] = useState(false);
  const [showFirstNameInfo, setShowFirstNameInfo] = useState(false);
  const [showLastNameInfo, setShowLastNameInfo] = useState(false);
  const [showAgeInfo, setShowAgeInfo] = useState(false);
  const [showPhoneInfo, setShowPhoneInfo] = useState(false);
  const [showUhidInfo, setShowUhidInfo] = useState(false);
  const [firstNameTouched, setFirstNameTouched] = useState(false);
  const [lastNameTouched, setLastNameTouched] = useState(false);
  const [ageTouched, setAgeTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [uhidTouched, setUhidTouched] = useState(false);

  const shouldShowUhidField = uhidFieldEnabled || !!patient.uhid;

  const validateField = (field: 'firstName' | 'lastName' | 'age' | 'phone' | 'uhid', value: string | number) => {
    // Only validate if user has typed at least 1 character
    if (value === '' || value === null || value === undefined) {
      return [];
    }
    
    const errors: string[] = [];
    const schema = PatientFormSchema.shape[field];
    const result = schema.safeParse(value);
    
    if (!result.success) {
      result.error.issues.forEach(issue => {
        errors.push(issue.message);
      });
    }
    
    return errors;
  };

  const handleFirstNameChange = (value: string) => {
    setPatient({ ...patient, firstName: value });
    if (value.length >= 1) {
      setFirstNameTouched(true);
      const errors = validateField('firstName', value);
      setFirstNameErrors(errors);
    } else {
      setFirstNameTouched(false);
      setFirstNameErrors([]);
    }
  };

  const handleLastNameChange = (value: string) => {
    setPatient({ ...patient, lastName: value });
    if (value.length >= 1) {
      setLastNameTouched(true);
      const errors = validateField('lastName', value);
      setLastNameErrors(errors);
    } else {
      setLastNameTouched(false);
      setLastNameErrors([]);
    }
  };

  const handleAgeChange = (value: string) => {
    const numValue = parseInt(value) || 0;
    setPatient({ ...patient, age: numValue });
    if (value.length >= 1) {
      setAgeTouched(true);
      const errors = validateField('age', numValue);
      setAgeErrors(errors);
    } else {
      setAgeTouched(false);
      setAgeErrors([]);
    }
  };

  const handlePhoneChange = (value: string) => {
    // Only allow digits, limit to 10 characters
    const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
    setPatient({ ...patient, phone: digitsOnly });
    if (digitsOnly.length >= 1) {
      setPhoneTouched(true);
      const errors = validateField('phone', digitsOnly);
      setPhoneErrors(errors);
    } else {
      setPhoneTouched(false);
      setPhoneErrors([]);
    }
  };

  const handleUhidChange = (value: string) => {
    // Only allow alphanumeric characters
    const alphanumericOnly = value.replace(/[^a-zA-Z0-9]/g, '');
    setPatient({ ...patient, uhid: alphanumericOnly });
    if (alphanumericOnly.length >= 1) {
      setUhidTouched(true);
      const errors = validateField('uhid', alphanumericOnly);
      setUhidErrors(errors);
    } else {
      setUhidTouched(false);
      setUhidErrors([]);
    }
  };

  const getValidationIcon = (errors: string[], value: string, touched: boolean, onMouseEnter: () => void, onMouseLeave: () => void) => {
    // Only show icon if field has been touched and has content
    if (!touched || !value || value.length < 1) return null;
    
    if (errors.length === 0) {
      return (
        <div 
          className="cursor-pointer"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
      );
    }
    
    return (
      <div 
        className="cursor-pointer"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293z" clipRule="evenodd" />
        </svg>
      </div>
    );
  };

  const ValidationPopup = ({ checks, show, value }: { errors: string[], checks: string[], show: boolean, value: string }) => {
    if (!show) return null;
    
    return (
      <div className="absolute z-10 mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg w-80 right-0">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Validation Rules:</h4>
        <ul className="space-y-1 text-xs">
          {checks.map((check, idx) => {
            // Determine if each rule passes based on actual validation
            let isValid = false;
            const numValue = parseInt(value) || 0;
            
            if (check.includes('Required field')) {
              isValid = value.length >= 1;
            } else if (check.includes('Maximum 100 characters')) {
              isValid = value.length <= 100;
            } else if (check.includes('Maximum 50 characters')) {
              isValid = value.length <= 50;
            } else if (check.includes('Must be a single word')) {
              isValid = !/\s/.test(value);
            } else if (check.includes('Only letters, spaces')) {
              isValid = /^[a-zA-Z\s'-]+$/.test(value);
            } else if (check.includes('Only letters, hyphens')) {
              isValid = /^[a-zA-Z'-]+$/.test(value);
            } else if (check.includes('No numbers')) {
              isValid = !/\d/.test(value);
            } else if (check.includes('No exponential')) {
              isValid = !/[eE][+-]?\d+/.test(value);
            } else if (check.includes('whole number')) {
              isValid = Number.isInteger(numValue);
            } else if (check.includes('0 or positive')) {
              isValid = numValue >= 0;
            } else if (check.includes('Maximum 100 years')) {
              isValid = numValue <= 100;
            } else if (check.includes('Maximum 3 digits')) {
              isValid = value.length <= 3;
            } else if (check.includes('exactly 10 digits')) {
              isValid = value.length === 10 && /^\d{10}$/.test(value);
            } else if (check.includes('Only numbers')) {
              isValid = /^\d+$/.test(value);
            } else if (check.includes('Only letters and numbers')) {
              isValid = /^[a-zA-Z0-9]+$/.test(value);
            }
            
            return (
              <li key={idx} className="flex items-start gap-2">
                {isValid ? (
                  <svg className="w-4 h-4 text-green-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293z" clipRule="evenodd" />
                  </svg>
                )}
                <span className={isValid ? 'text-gray-700' : 'text-red-600'}>{check}</span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const firstNameValidationChecks = [
    'Required field',
    'Maximum 100 characters',
    'Only letters, spaces, hyphens, and apostrophes',
    'No numbers allowed',
    'No exponential notation',
  ];

  const lastNameValidationChecks = [
    'Required field',
    'Maximum 50 characters',
    'Only letters, hyphens, and apostrophes',
    'Must be a single word (no spaces)',
    'No numbers allowed',
    'No exponential notation',
  ];

  const ageValidationChecks = [
    'Required field',
    'Must be a whole number',
    'Must be 0 or positive',
    'Maximum 100 years',
    'Maximum 3 digits',
  ];

  const phoneValidationChecks = [
    'Must be exactly 10 digits',
    'Only numbers allowed',
  ];

  const uhidValidationChecks = [
    'Maximum 50 characters',
    'Only letters and numbers',
  ];

  return (
    <section>
      <h3 className="text-lg font-semibold text-[#5F3794] mb-2">Patient Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            First Name<span className="text-red-500">*</span> <span className='text-xs'>(can include Middle Names)</span>
          </label>
          <div className="relative">
            <input
              type="text"
              required
              value={patient.firstName || ''}
              onChange={(e) => handleFirstNameChange(e.target.value)}
              className={`w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 ${
                firstNameTouched && firstNameErrors.length > 0 && patient.firstName
                  ? 'border-red-500 focus:ring-red-500'
                  : firstNameTouched && patient.firstName && firstNameErrors.length === 0
                  ? 'border-green-500 focus:ring-green-500'
                  : 'border-gray-300 focus:ring-blue-500'
              } placeholder-gray-400`}
              placeholder='e.g., John Michael'
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {getValidationIcon(
                firstNameErrors, 
                patient.firstName || '', 
                firstNameTouched,
                () => setShowFirstNameInfo(true),
                () => setShowFirstNameInfo(false)
              )}
            </div>
          </div>
          <ValidationPopup 
            errors={firstNameErrors} 
            checks={firstNameValidationChecks} 
            show={showFirstNameInfo}
            value={patient.firstName || ''}
          />
        </div>
        <div className="relative">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Last Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              required
              value={patient.lastName || ''}
              onChange={(e) => handleLastNameChange(e.target.value)}
              className={`w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 ${
                lastNameTouched && lastNameErrors.length > 0 && patient.lastName
                  ? 'border-red-500 focus:ring-red-500'
                  : lastNameTouched && patient.lastName && lastNameErrors.length === 0
                  ? 'border-green-500 focus:ring-green-500'
                  : 'border-gray-300 focus:ring-blue-500'
              } placeholder-gray-400`}
              placeholder='e.g., Doe'
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {getValidationIcon(
                lastNameErrors, 
                patient.lastName || '', 
                lastNameTouched,
                () => setShowLastNameInfo(true),
                () => setShowLastNameInfo(false)
              )}
            </div>
          </div>
          <ValidationPopup 
            errors={lastNameErrors} 
            checks={lastNameValidationChecks} 
            show={showLastNameInfo}
            value={patient.lastName || ''}
          />
        </div>
        <div className="relative">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Age <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              required
              max="100"
              value={patient.age || ''}
              onChange={(e) => handleAgeChange(e.target.value)}
              className={`w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 ${
                ageTouched && ageErrors.length > 0 && patient.age
                  ? 'border-red-500 focus:ring-red-500'
                  : ageTouched && patient.age && ageErrors.length === 0
                  ? 'border-green-500 focus:ring-green-500'
                  : 'border-gray-300 focus:ring-blue-500'
              } placeholder-gray-400`}
              placeholder="e.g., 30"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {getValidationIcon(
                ageErrors, 
                patient.age?.toString() || '', 
                ageTouched,
                () => setShowAgeInfo(true),
                () => setShowAgeInfo(false)
              )}
            </div>
          </div>
          <ValidationPopup 
            errors={ageErrors} 
            checks={ageValidationChecks} 
            show={showAgeInfo}
            value={patient.age?.toString() || ''}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Gender <span className="text-red-500">*</span>
          </label>
          <select
            value={patient.gender}
            onChange={(e) => setPatient({ ...patient, gender: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        {!shouldShowUhidField ? (
          <div>
            <button
              type="button"
              onClick={() => setUhidFieldEnabled(true)}
              className="text-sm font-medium text-gray-600 hover:text-gray-800 underline"
            >
              + Add UHID (optional)
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-600">
                UHID No.
              </label>
              {!patient.uhid && (
                <button
                  type="button"
                  onClick={() => setUhidFieldEnabled(false)}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Hide
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                value={patient.uhid}
                onChange={(e) => handleUhidChange(e.target.value)}
                className={`w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 ${
                  uhidTouched && uhidErrors.length > 0 && patient.uhid
                    ? 'border-red-500 focus:ring-red-500'
                    : uhidTouched && patient.uhid && uhidErrors.length === 0
                    ? 'border-green-500 focus:ring-green-500'
                    : 'border-gray-300 focus:ring-blue-500'
                } placeholder-gray-400`}
                placeholder="e.g., ABC123"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                {getValidationIcon(
                  uhidErrors,
                  patient.uhid || '',
                  uhidTouched,
                  () => setShowUhidInfo(true),
                  () => setShowUhidInfo(false)
                )}
              </div>
            </div>
            <ValidationPopup
              errors={uhidErrors}
              checks={uhidValidationChecks}
              show={showUhidInfo}
              value={patient.uhid || ''}
            />
          </div>
        )}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Contact Number
          </label>
          <div className="relative">
            <input
              type="tel"
              maxLength={10}
              value={patient.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className={`w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 ${
                phoneTouched && phoneErrors.length > 0 && patient.phone
                  ? 'border-red-500 focus:ring-red-500'
                  : phoneTouched && patient.phone && phoneErrors.length === 0
                  ? 'border-green-500 focus:ring-green-500'
                  : 'border-gray-300 focus:ring-blue-500'
              } placeholder-gray-400`}
              placeholder="e.g., 9876543210"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {getValidationIcon(
                phoneErrors, 
                patient.phone || '', 
                phoneTouched,
                () => setShowPhoneInfo(true),
                () => setShowPhoneInfo(false)
              )}
            </div>
          </div>
          <ValidationPopup 
            errors={phoneErrors} 
            checks={phoneValidationChecks} 
            show={showPhoneInfo}
            value={patient.phone || ''}
          />
        </div>
      </div>
    </section>
  );
};

export default PatientForm;
