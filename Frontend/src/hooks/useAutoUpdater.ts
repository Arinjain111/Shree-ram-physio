import { useState, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'not-available';

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface UpdateState {
  status: UpdateStatus;
  version?: string;
  progress?: UpdateProgress;
  error?: string;
}

export function useAutoUpdater() {
  const [state, setState] = useState<UpdateState>({ status: 'idle' });

  useEffect(() => {
    const handler = (_event: any, data: UpdateState) => {
      setState(data);
    };
    
    // Listen to update status events
    ipcRenderer.on('update-status', handler);
    
    return () => {
      ipcRenderer.removeListener('update-status', handler);
    };
  }, []);

  const installUpdate = async () => {
    await ipcRenderer.invoke('install-update');
  };

  const checkForUpdates = async () => {
    await ipcRenderer.invoke('check-for-updates');
  };

  const dismissError = () => {
    setState({ status: 'idle' });
  };

  return { ...state, installUpdate, checkForUpdates, dismissError };
}
