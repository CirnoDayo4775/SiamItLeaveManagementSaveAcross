/**
 * Centralized Logger Utility
 * Provides consistent logging across the application with environment-aware output
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
    enabled: boolean;
    minLevel: LogLevel;
}

class Logger {
    private config: LoggerConfig = {
        enabled: import.meta.env.DEV,
        minLevel: 'debug'
    };

    private levelPriority: Record<LogLevel, number> = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
    };

    private shouldLog(level: LogLevel): boolean {
        if (!this.config.enabled) return false;
        return this.levelPriority[level] >= this.levelPriority[this.config.minLevel];
    }

    /**
     * Debug level logging - only in development
     */
    debug(...args: any[]): void {
        if (this.shouldLog('debug')) {
            console.log('[DEBUG]', ...args);
        }
    }

    /**
     * Info level logging
     */
    info(...args: any[]): void {
        if (this.shouldLog('info')) {
            console.log('[INFO]', ...args);
        }
    }

    /**
     * Warning level logging
     */
    warn(...args: any[]): void {
        if (this.shouldLog('warn')) {
            console.warn('[WARN]', ...args);
        }
    }

    /**
     * Error level logging - always enabled even in production
     */
    error(...args: any[]): void {
        if (import.meta.env.DEV || this.shouldLog('error')) {
            console.error('[ERROR]', ...args);
        }
    }

    /**
     * Configure logger
     */
    configure(config: Partial<LoggerConfig>): void {
        this.config = { ...this.config, ...config };
    }
}

// Singleton instance
export const logger = new Logger();

// Export for backward compatibility with existing code
export default logger;
