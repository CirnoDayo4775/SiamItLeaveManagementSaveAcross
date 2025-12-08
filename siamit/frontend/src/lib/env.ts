import { logger } from './logger';

/**
 * Environment Configuration
 * Validates and provides type-safe access to environment variables
 */

interface EnvConfig {
    apiBaseUrl: string;
    isDevelopment: boolean;
    isProduction: boolean;
    mode: string;
}

class EnvironmentValidator {
    private config: EnvConfig | null = null;

    /**
     * Validate required environment variables
     * @throws Error if required variables are missing
     */
    private validateRequiredVars(): void {
        const requiredVars = ['VITE_API_BASE_URL'];
        const missing: string[] = [];

        for (const varName of requiredVars) {
            if (!import.meta.env[varName]) {
                missing.push(varName);
            }
        }

        if (missing.length > 0) {
            const errorMsg = `Missing required environment variables: ${missing.join(', ')}`;
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }
    }

    /**
     * Validate environment variable format
     */
    private validateFormat(): void {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

        // Validate API base URL format
        if (apiBaseUrl && !apiBaseUrl.startsWith('http')) {
            logger.warn(`VITE_API_BASE_URL should start with http:// or https://. Got: ${apiBaseUrl}`);
        }

        // Check for trailing slashes (which can cause issues)
        if (apiBaseUrl && apiBaseUrl.endsWith('/')) {
            logger.warn('VITE_API_BASE_URL has trailing slash. This may cause issues with URL joining.');
        }
    }

    /**
     * Initialize and validate environment configuration
     */
    init(): EnvConfig {
        if (this.config) {
            return this.config;
        }

        try {
            this.validateRequiredVars();
            this.validateFormat();

            this.config = {
                apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
                isDevelopment: import.meta.env.DEV,
                isProduction: import.meta.env.PROD,
                mode: import.meta.env.MODE || 'development'
            };

            logger.info('Environment configuration validated successfully');
            logger.debug('Environment config:', this.config);

            return this.config;
        } catch (error) {
            logger.error('Environment validation failed:', error);
            throw error;
        }
    }

    /**
     * Get validated configuration
     * @throws Error if not initialized
     */
    getConfig(): EnvConfig {
        if (!this.config) {
            throw new Error('Environment not initialized. Call init() first.');
        }
        return this.config;
    }

    /**
     * Check if a specific environment variable is set
     */
    has(key: string): boolean {
        return import.meta.env[key] !== undefined;
    }

    /**
     * Get environment variable with fallback
     */
    get(key: string, fallback?: string): string | undefined {
        return import.meta.env[key] || fallback;
    }
}

// Singleton instance
export const env = new EnvironmentValidator();

// Initialize on module load
try {
    env.init();
} catch (error) {
    // Allow app to start but log error
    logger.error('Failed to initialize environment:', error);
}

export default env;
