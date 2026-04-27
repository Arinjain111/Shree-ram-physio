import React from 'react';
import { useAutoUpdater } from '@/hooks/useAutoUpdater';

const UpdateBanner: React.FC = () => {
  const { status, version, progress, error, installUpdate, dismissError } = useAutoUpdater();

  if (status === 'idle' || status === 'not-available') return null;

  return (
    <div className="w-full bg-slate-900 text-white px-4 py-2 flex items-center justify-between text-sm shadow-md relative z-50">
      <div className="flex items-center gap-3">
        {status === 'checking' && (
          <>
            <svg className="w-5 h-5 animate-spin text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Checking for updates...</span>
          </>
        )}
        {status === 'available' && (
          <>
            <svg className="w-5 h-5 text-blue-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            <span>Version {version} is available. Preparing download...</span>
          </>
        )}
        {status === 'downloading' && (
          <>
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            <div className="flex items-center gap-4">
              <span>Downloading update {version}...</span>
              <div className="w-48 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress?.percent || 0}%` }}
                />
              </div>
              <span className="text-slate-400 font-mono text-xs">
                {Math.round(progress?.percent || 0)}%
              </span>
            </div>
          </>
        )}
        {status === 'downloaded' && (
          <>
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Update {version} is ready to install!</span>
          </>
        )}
        {status === 'error' && (
          <>
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-red-200">Update failed: {error || 'Unknown error'}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {status === 'downloaded' && (
          <button 
            onClick={installUpdate}
            className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded font-medium transition-colors shadow-sm"
          >
            Restart to Update
          </button>
        )}
        {(status === 'error' || status === 'checking' || status === 'downloaded') && (
          <button onClick={dismissError} className="p-1 hover:bg-slate-800 rounded transition-colors group" title="Dismiss">
            <svg className="w-5 h-5 text-slate-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default UpdateBanner;
