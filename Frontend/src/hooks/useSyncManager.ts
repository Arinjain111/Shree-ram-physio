import { useState, useEffect, useCallback } from 'react';
import { useErrorHandler } from './useErrorHandler';

const { ipcRenderer } = window.require('electron');

export const useSyncManager = () => {
    const { handleError } = useErrorHandler();

    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
    const [syncMessage, setSyncMessage] = useState<string>('');
    const [dbStats, setDbStats] = useState<{ patients: number; invoices: number } | null>(null);

    const loadDatabaseStats = useCallback(async () => {
        try {
            const result = await ipcRenderer.invoke('get-database-stats');
            if (result.success) {
                setDbStats(result.stats);
            }
        } catch (error) {
            console.error('Error loading database stats:', error);
        }
    }, []);

    const syncNow = useCallback(async () => {
        setIsSyncing(true);
        setSyncMessage('Syncing with backend...');
        try {
            const result = await ipcRenderer.invoke('sync-now');
            if (result.success) {
                const msg = result.result.message || 'Sync completed successfully!';
                setSyncMessage(msg);
                setLastSyncTime(result.result.lastSyncTime || new Date().toISOString());

                // Broadcast update
                window.dispatchEvent(new CustomEvent('invoices-updated'));

                // Clear message after delay
                setTimeout(() => setSyncMessage(''), 3000);
                return true;
            } else {
                throw new Error(result.error || 'Sync failed unknown error');
            }
        } catch (error) {
            console.error('Error syncing:', error);
            setSyncMessage('Sync failed');
            handleError(error, 'Sync with backend failed');
            setTimeout(() => setSyncMessage(''), 5000);
            return false;
        } finally {
            setIsSyncing(false);
            loadDatabaseStats();
        }
    }, [handleError, loadDatabaseStats]);

    // Initializer & Listeners
    useEffect(() => {
        loadDatabaseStats();

        const handleSyncCompleted = (_event: any, data: any) => {
            if (data?.timestamp) setLastSyncTime(data.timestamp);
            loadDatabaseStats();
        };

        // Listen for manual syncs triggered from other components
        const handleManualSyncEvent = () => {
            loadDatabaseStats();
        };

        ipcRenderer.on('sync-completed', handleSyncCompleted);
        window.addEventListener('invoices-updated', handleManualSyncEvent);

        return () => {
            ipcRenderer.removeListener('sync-completed', handleSyncCompleted);
            window.removeEventListener('invoices-updated', handleManualSyncEvent);
        };
    }, [loadDatabaseStats]);

    return {
        isSyncing,
        syncMessage,
        lastSyncTime,
        dbStats,
        syncNow,
        refreshStats: loadDatabaseStats
    };
};
