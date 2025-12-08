import React, { Component, ReactNode, Suspense } from 'react';
import { AlertTriangle } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { logger } from '@/lib/logger';

interface LazyErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

interface LazyErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

/**
 * Error Boundary specifically for lazy-loaded components
 * Catches errors during lazy loading and rendering
 */
class LazyErrorBoundary extends Component<LazyErrorBoundaryProps, LazyErrorBoundaryState> {
    constructor(props: LazyErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null
        };
    }

    static getDerivedStateFromError(error: Error): LazyErrorBoundaryState {
        return {
            hasError: true,
            error
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        // Log error for debugging in development
        if (import.meta.env.DEV) {
            logger.error('LazyLoadError:', error, errorInfo);
        }
    }

    handleRetry = (): void => {
        this.setState({
            hasError: false,
            error: null
        });
        // Force page reload to retry loading the component
        window.location.reload();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4">
                    <div className="max-w-md w-full">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
                            <div className="flex flex-col items-center text-center space-y-6">
                                <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
                                    <AlertTriangle className="w-10 h-10 text-orange-600 dark:text-orange-400" />
                                </div>

                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                        เกิดข้อผิดพลาดในการโหลด
                                    </h2>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        ไม่สามารถโหลดส่วนนี้ของแอปพลิเคชันได้
                                    </p>
                                </div>

                                {import.meta.env.DEV && this.state.error && (
                                    <div className="w-full p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                        <p className="text-xs font-mono text-red-800 dark:text-red-300 break-all">
                                            {this.state.error.message}
                                        </p>
                                    </div>
                                )}

                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={() => window.history.back()}
                                        className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-xl transition-colors"
                                    >
                                        ย้อนกลับ
                                    </button>
                                    <button
                                        onClick={this.handleRetry}
                                        className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg transition-all duration-200"
                                    >
                                        ลองอีกครั้ง
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Wrapper component that combines Suspense and Error Boundary for lazy-loaded components
 */
interface LazyLoadWrapperProps {
    children: ReactNode;
    fallback?: ReactNode;
    errorFallback?: ReactNode;
}

export function LazyLoadWrapper({ children, fallback, errorFallback }: LazyLoadWrapperProps) {
    return (
        <LazyErrorBoundary fallback={errorFallback}>
            <Suspense fallback={fallback || <LoadingSpinner />}>
                {children}
            </Suspense>
        </LazyErrorBoundary>
    );
}

export default LazyErrorBoundary;
