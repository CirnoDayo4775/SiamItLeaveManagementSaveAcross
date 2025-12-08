/**
 * Fetch with Timeout Wrapper
 * Adds configurable timeout to fetch requests to prevent hanging
 */

export interface FetchWithTimeoutOptions extends RequestInit {
    timeout?: number; // Timeout in milliseconds
}

/**
 * Fetch wrapper that adds timeout support
 * @param url - URL to fetch
 * @param options - Fetch options with optional timeout
 * @returns Promise that rejects on timeout
 * 
 * @example
 * const response = await fetchWithTimeout('/api/data', { timeout: 5000 });
 */
export async function fetchWithTimeout(
    url: string,
    options: FetchWithTimeoutOptions = {}
): Promise<Response> {
    const { timeout = 30000, ...fetchOptions } = options; // Default 30 seconds

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response;
    } catch (error: any) {
        clearTimeout(timeoutId);

        // Check if error was due to abort (timeout)
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeout}ms`);
        }

        throw error;
    }
}

/**
 * Create a fetch wrapper with a specific default timeout
 * Useful for creating API-specific fetch functions
 * 
 * @example
 * const apiFetch = createFetchWithTimeout(10000); // 10 second default
 * const response = await apiFetch('/api/data');
 */
export function createFetchWithTimeout(defaultTimeout: number) {
    return (url: string, options: FetchWithTimeoutOptions = {}) => {
        return fetchWithTimeout(url, {
            timeout: defaultTimeout,
            ...options
        });
    };
}

export default fetchWithTimeout;
