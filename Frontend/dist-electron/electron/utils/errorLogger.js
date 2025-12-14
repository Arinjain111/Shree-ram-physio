"use strict";
/**
 * Concise Error Logger Utility
 * Formats errors in a readable, minimal format
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logError = logError;
exports.logWarning = logWarning;
exports.logInfo = logInfo;
exports.logSuccess = logSuccess;
/**
 * Logs errors in a concise format: [ERROR_CODE] Message - Location
 */
function logError(context, error) {
    const details = parseError(error);
    const errorCode = details.code ? `[${details.code}]` : '[ERROR]';
    const location = details.location ? ` - ${details.location}` : '';
    console.error(`${errorCode} ${context}: ${details.message}${location}`);
}
/**
 * Logs warnings in a concise format
 */
function logWarning(context, message) {
    console.warn(`[WARN] ${context}: ${message}`);
}
/**
 * Logs info in a concise format (only in development)
 */
function logInfo(context, message) {
    if (process.env.NODE_ENV === 'development') {
        console.log(`[INFO] ${context}: ${message}`);
    }
}
/**
 * Parse error object to extract relevant details
 */
function parseError(error) {
    // Axios errors with API response
    if (error.isAxiosError) {
        // Check if backend sent structured error response
        if (error.response?.data) {
            const apiError = error.response.data;
            return {
                code: apiError.code || `HTTP_${error.response.status}`,
                message: apiError.message || error.message,
                location: error.config?.url
            };
        }
        // Network errors
        if (error.code === 'ECONNREFUSED') {
            return {
                code: 'ECONNREFUSED',
                message: 'Backend server not running',
                location: error.config?.url
            };
        }
        // Other axios errors
        return {
            code: error.code || 'NETWORK_ERROR',
            message: error.message,
            location: error.config?.url
        };
    }
    // Prisma errors
    if (error.code?.startsWith('P')) {
        return {
            code: error.code,
            message: error.message?.split('\n')[0] || 'Database error',
            location: error.meta?.target
        };
    }
    // Standard errors
    return {
        code: error.code || error.name,
        message: error.message || String(error),
        location: error.stack?.split('\n')[1]?.trim()
    };
}
/**
 * Format success message
 */
function logSuccess(context, message) {
    console.log(`✅ ${context}: ${message}`);
}
