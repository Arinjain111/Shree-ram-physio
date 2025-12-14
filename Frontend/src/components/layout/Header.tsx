import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string>('');
  
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Home';
      case '/invoice-generator':
        return 'Invoice Generator';
      case '/invoice-customizer':
        return 'Invoice Customizer';
      case '/database-find':
        return 'Database Find';
      case '/treatment-settings':
        return 'Add Predefined Presets';
      default:
        return 'Shree Ram Physiotherapy';
    }
  };

  const showBackButton = location.pathname !== '/';

  useEffect(() => {
    const handleSyncCompleted = (_event: any, data: any) => {
      setLastSyncTime(data.timestamp);
    };
    
    ipcRenderer.on('sync-completed', handleSyncCompleted);
    
    return () => {
      ipcRenderer.removeListener('sync-completed', handleSyncCompleted);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncMessage('Syncing with backend...');
    try {
      const result = await ipcRenderer.invoke('sync-now');
      if (result.success) {
        setSyncMessage(result.result.message || 'Sync completed successfully!');
        setLastSyncTime(result.result.lastSyncTime || new Date().toISOString());
        setTimeout(() => setSyncMessage(''), 3000);
        window.dispatchEvent(new CustomEvent('invoices-updated'));
      } else {
        setSyncMessage('Sync failed: ' + (result.error || 'Unknown error'));
        setTimeout(() => setSyncMessage(''), 5000);
      }
    } catch (error) {
      console.error('Error syncing:', error);
      setSyncMessage('Sync failed: ' + String(error));
      setTimeout(() => setSyncMessage(''), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  const showSyncButton = location.pathname === '/database-find';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md m-4 rounded-xl">
      <div className="max-w-full mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          {showBackButton && (
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
            >
              ← Back
            </button>
          )}
          <h1 className="text-3xl font-bold text-slate-800">{getPageTitle()}</h1>
        </div>
        <div id="header-actions" className="flex items-center gap-4">
          {showSyncButton && (
            <div className="flex flex-col items-end">
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className={`px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 shadow-sm ${
                  isSyncing
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md active:scale-95'
                }`}
              >
                {isSyncing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Sync Now</span>
                  </>
                )}
              </button>
              {(syncMessage || lastSyncTime) && (
                <div className="mt-2 text-right">
                  {syncMessage && (
                    <p className={`text-xs font-medium ${
                      syncMessage.includes('failed') ? 'text-rose-500' : 'text-emerald-600'
                    }`}>
                      {syncMessage}
                    </p>
                  )}
                  {!syncMessage && lastSyncTime && (
                    <p className="text-[10px] text-slate-400 font-medium">
                      Last synced: {new Date(lastSyncTime).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
