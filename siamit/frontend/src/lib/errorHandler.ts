import { logger } from './logger';

/**
 * Standard error response from API
 */
export interface ApiError {
    message: string;
    status?: number;
    code?: string;
    details?: any;
}

/**
 * Centralized error handler for the application
 * Provides consistent error handling, logging, and user-friendly messages
 */
export class ErrorHandler {
    /**
     * Handle API errors with consistent logging and user messages
     */
    static handleApiError(error: any, context?: string): ApiError {
        const contextMsg = context ? `[${context}]` : '';

        // Log error for debugging
        logger.error(`${contextMsg} API Error:`, error);

        // Extract error information
        if (error?.response) {
            // HTTP error response
            return {
                message: error.response.data?.message || error.message || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์',
                status: error.response.status,
                code: error.response.data?.code,
                details: error.response.data?.details
            };
        }

        if (error?.message) {
            // JavaScript Error object
            return {
                message: error.message,
                details: error
            };
        }

        // Unknown error format
        return {
            message: 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',
            details: error
        };
    }

    /**
     * Handle network errors (connection issues, timeout, etc.)
     */
    static handleNetworkError(error: any): ApiError {
        logger.error('Network Error:', error);

        if (error?.message?.includes('timeout')) {
            return {
                message: 'การเชื่อมต่อหมดเวลา กรุณาลองใหม่อีกครั้ง',
                code: 'TIMEOUT'
            };
        }

        if (error?.message?.includes('Network')) {
            return {
                message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
                code: 'NETWORK_ERROR'
            };
        }

        return {
            message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ',
            code: 'CONNECTION_ERROR',
            details: error
        };
    }

    /**
     * Handle validation errors
     */
    static handleValidationError(fields: Record<string, string>): ApiError {
        logger.warn('Validation Error:', fields);

        const messages = Object.entries(fields)
            .map(([field, message]) => `${field}: ${message}`)
            .join(', ');

        return {
            message: `ข้อมูลไม่ถูกต้อง: ${messages}`,
            code: 'VALIDATION_ERROR',
            details: fields
        };
    }

    /**
     * Handle authentication errors
     */
    static handleAuthError(error: any): ApiError {
        logger.error('Auth Error:', error);

        return {
            message: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
            status: 401,
            code: 'AUTH_ERROR',
            details: error
        };
    }

    /**
     * Handle permission errors
     */
    static handlePermissionError(): ApiError {
        logger.warn('Permission denied');

        return {
            message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้',
            status: 403,
            code: 'PERMISSION_DENIED'
        };
    }

    /**
     * Get user-friendly error message based on status code
     */
    static getMessageForStatus(status: number): string {
        switch (status) {
            case 400:
                return 'ข้อมูลที่ส่งมาไม่ถูกต้อง';
            case 401:
                return 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง';
            case 403:
                return 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้';
            case 404:
                return 'ไม่พบข้อมูลที่ต้องการ';
            case 409:
                return 'ข้อมูลซ้ำกับที่มีอยู่แล้ว';
            case 422:
                return 'ข้อมูลไม่ถูกต้อง';
            case 429:
                return 'คุณทำรายการบ่อยเกินไป กรุณารอสักครู่';
            case 500:
                return 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์';
            case 502:
            case 503:
                return 'เซิร์ฟเวอร์ไม่พร้อมให้บริการชั่วคราว';
            case 504:
                return 'เซิร์ฟเวอร์ตอบสนองช้าเกินไป';
            default:
                return 'เกิดข้อผิดพลาด';
        }
    }

    /**
     * Format error for display to user
     */
    static formatError(error: ApiError, showDetails: boolean = false): string {
        let message = error.message;

        if (error.status) {
            const statusMessage = this.getMessageForStatus(error.status);
            if (statusMessage !== error.message) {
                message = `${statusMessage}: ${message}`;
            }
        }

        if (showDetails && error.details && import.meta.env.DEV) {
            message += `\n\nรายละเอียด: ${JSON.stringify(error.details, null, 2)}`;
        }

        return message;
    }
}

/**
 * Error handler hook for React components
 */
export function useErrorHandler() {
    return {
        handleError: (error: any, context?: string) => {
            return ErrorHandler.handleApiError(error, context);
        },
        handleNetworkError: (error: any) => {
            return ErrorHandler.handleNetworkError(error);
        },
        handleAuthError: (error: any) => {
            return ErrorHandler.handleAuthError(error);
        },
        formatError: (error: ApiError, showDetails?: boolean) => {
            return ErrorHandler.formatError(error, showDetails);
        }
    };
}

export default ErrorHandler;
