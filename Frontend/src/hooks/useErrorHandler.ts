import { useCallback } from 'react';
import { useUI } from '@/context/UIContext';
import { handleFrontendError, NormalizedApiError } from '@/services/errorHandler';

export const useErrorHandler = () => {
    const { showToast } = useUI();

    const handleError = useCallback((error: unknown, fallbackMessage?: string): NormalizedApiError => {
        // If it's already a normalized error, just show it
        if (typeof error === 'object' && error !== null && 'message' in error && 'isNetworkError' in error) {
            return handleFrontendError(error, showToast, fallbackMessage);
        }

        // Handle common Electron/IPC Error shapes that might be missed
        if (error && typeof error === 'object') {
            // Sometimes IPC errors come as { message: "Error invoking remote method...: Actual Error" }
            const msg = (error as any).message;
            if (typeof msg === 'string' && msg.includes('Error invoking remote method')) {
                const actualError = msg.split(':').slice(1).join(':').trim();
                if (actualError) {
                    return handleFrontendError({ ...error, message: actualError }, showToast, fallbackMessage);
                }
            }
        }

        return handleFrontendError(error, showToast, fallbackMessage);
    }, [showToast]);

    return { handleError };
};
