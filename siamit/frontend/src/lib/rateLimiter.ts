import { logger } from '@/lib/logger';
/**
 * Rate Limiter Utility
 * Implements client-side rate limiting to prevent abuse and improve security
 */

interface RateLimitConfig {
    maxAttempts: number;
    windowMs: number;
    blockDurationMs?: number;
}

interface RateLimitEntry {
    attempts: number;
    firstAttemptTime: number;
    blockedUntil?: number;
}

class RateLimiter {
    private limits: Map<string, RateLimitEntry> = new Map();
    private configs: Map<string, RateLimitConfig> = new Map();

    /**
     * Configure rate limit for a specific key
     */
    configure(key: string, config: RateLimitConfig): void {
        this.configs.set(key, config);
    }

    /**
     * Check if an action is allowed
     * @returns true if allowed, false if rate limited
     */
    isAllowed(key: string): boolean {
        const config = this.configs.get(key);
        if (!config) {
            logger.warn(`Rate limit config not found for key: ${key}`);
            return true; // Allow if no config
        }

        const now = Date.now();
        const entry = this.limits.get(key);

        // No previous attempts
        if (!entry) {
            this.limits.set(key, {
                attempts: 1,
                firstAttemptTime: now
            });
            return true;
        }

        // Check if currently blocked
        if (entry.blockedUntil && now < entry.blockedUntil) {
            return false;
        }

        // Reset if outside time window
        const timeElapsed = now - entry.firstAttemptTime;
        if (timeElapsed > config.windowMs) {
            this.limits.set(key, {
                attempts: 1,
                firstAttemptTime: now
            });
            return true;
        }

        // Increment attempts
        entry.attempts++;

        // Check if exceeded limit
        if (entry.attempts > config.maxAttempts) {
            const blockDuration = config.blockDurationMs || config.windowMs;
            entry.blockedUntil = now + blockDuration;
            this.limits.set(key, entry);
            return false;
        }

        this.limits.set(key, entry);
        return true;
    }

    /**
     * Get remaining time until unblocked (in milliseconds)
     */
    getBlockedTimeRemaining(key: string): number {
        const entry = this.limits.get(key);
        if (!entry || !entry.blockedUntil) {
            return 0;
        }

        const remaining = entry.blockedUntil - Date.now();
        return Math.max(0, remaining);
    }

    /**
     * Get number of attempts remaining
     */
    getRemainingAttempts(key: string): number {
        const config = this.configs.get(key);
        const entry = this.limits.get(key);

        if (!config) return Infinity;
        if (!entry) return config.maxAttempts;

        const now = Date.now();
        const timeElapsed = now - entry.firstAttemptTime;

        // Reset if outside window
        if (timeElapsed > config.windowMs) {
            return config.maxAttempts;
        }

        return Math.max(0, config.maxAttempts - entry.attempts);
    }

    /**
     * Reset rate limit for a specific key
     */
    reset(key: string): void {
        this.limits.delete(key);
    }

    /**
     * Clear all rate limits
     */
    clearAll(): void {
        this.limits.clear();
    }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Pre-configured rate limits for common actions
export const RateLimitKeys = {
    LOGIN: 'login',
    REGISTER: 'register',
    PASSWORD_RESET: 'password-reset',
    API_GENERAL: 'api-general'
} as const;

// Initialize default configurations
rateLimiter.configure(RateLimitKeys.LOGIN, {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 15 * 60 * 1000 // Block for 15 minutes
});

rateLimiter.configure(RateLimitKeys.REGISTER, {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDurationMs: 60 * 60 * 1000 // Block for 1 hour
});

rateLimiter.configure(RateLimitKeys.PASSWORD_RESET, {
    maxAttempts: 3,
    windowMs: 30 * 60 * 1000, // 30 minutes
    blockDurationMs: 30 * 60 * 1000 // Block for 30 minutes
});

rateLimiter.configure(RateLimitKeys.API_GENERAL, {
    maxAttempts: 100,
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 60 * 1000 // Block for 1 minute
});

/**
 * Helper function to format remaining time
 */
export function formatRemainingTime(ms: number): string {
    const minutes = Math.ceil(ms / 60000);
    if (minutes < 1) return 'น้อยกว่า 1 นาที';
    if (minutes === 1) return '1 นาที';
    return `${minutes} นาที`;
}
