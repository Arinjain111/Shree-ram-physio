import { useState, useEffect } from 'react';
import { useUI } from '@/context/UIContext';
import PageHeader from '@/components/layout/PageHeader';
import { handleFrontendError } from '@/services/errorHandler';

const { ipcRenderer } = window.require('electron');

const Settings = () => {
  const { showToast } = useUI();
  const [saveLocation, setSaveLocation] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const result = await ipcRenderer.invoke('get-save-location');
      if (result.success) {
        setSaveLocation(result.location);
      }
    } catch (error) {
      handleFrontendError(error, showToast, 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChooseLocation = async () => {
    try {
      const result = await ipcRenderer.invoke('choose-save-location');
      if (result.success) {
        setSaveLocation(result.location);
        showToast('success', `Save location updated to: ${result.location}`);
      } else {
        showToast('info', 'No location selected');
      }
    } catch (error) {
      handleFrontendError(error, showToast, 'Failed to change save location');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50 px-6 pb-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 px-6 pb-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <PageHeader 
          title="Settings"
          icon={
            <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          }
        />

        {/* Invoice Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Invoice Settings</h3>
          </div>

          <div className="space-y-6">
            {/* Save Location */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Invoice Save Location
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Choose where invoice PDFs will be automatically saved when printing.
              </p>
              
              <div className="flex items-center gap-3">
                <div className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-mono break-all">
                  {saveLocation || 'Not set'}
                </div>
                <button
                  onClick={handleChooseLocation}
                  className="px-5 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors flex items-center gap-2 shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Choose Folder
                </button>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">Auto-Save Feature</h4>
                  <p className="text-xs text-blue-700">
                    When you print an invoice, it will be automatically saved as a PDF to this location with the filename format: 
                    <span className="font-mono bg-blue-100 px-1.5 py-0.5 rounded ml-1">Invoice_[Number]_[Date].pdf</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* About Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800">About</h3>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Application Name</span>
              <span className="font-medium text-slate-800">Shri Ram Physio</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Version</span>
              <span className="font-medium text-slate-800">1.0.0</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-600">Developer</span>
              <span className="font-medium text-slate-800">Shree Ram Physiotherapy</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
