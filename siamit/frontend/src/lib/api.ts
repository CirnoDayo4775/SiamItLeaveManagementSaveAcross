// Centralized API Service
// This file provides a centralized way to handle all API calls with proper authentication


export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Helper function to get auth token

const getAuthToken = (): string | null => {
  try {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const token = currentUser?.token;

    if (!token) {
      if (import.meta.env.DEV) {
        console.warn("No token found in localStorage");
      }
      return null; // คืน null ถ้าไม่มี token
    }

    return token; // คืน string ของ token
  } catch (e) {
    if (import.meta.env.DEV) {
      console.error("Error parsing currentUser from localStorage", e);
    }
    return null;
  }
};


// Helper function to create authenticated file URL
export const createAuthenticatedFileUrl = (filePath: string): string => {
  const token = getAuthToken();
  if (!token) return filePath;

  const url = new URL(filePath, API_BASE_URL);
  url.searchParams.set('token', token);
  return url.toString();
};

// Helper to join base URL and endpoint safely
function joinUrl(base: string, endpoint: string): string {
  if (/^https?:\/\//.test(endpoint)) return endpoint;
  if (base.endsWith('/') && endpoint.startsWith('/')) {
    return base + endpoint.slice(1);
  }
  if (!base.endsWith('/') && !endpoint.startsWith('/')) {
    return base + '/' + endpoint;
  }
  return base + endpoint;
}

// Helper function to create auth headers (handle FormData)
const createAuthHeaders = (customHeaders?: Record<string, string>, data?: any): Record<string, string> => {
  const token = getAuthToken();
  const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
  return {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...customHeaders
  };
};

// Base fetch function with authentication (handle FormData)
const fetchWithAuth = async (
  url: string,
  options: RequestInit = {},
  logoutFn?: () => void,
  sessionExpiredFn?: () => void
): Promise<Response | null> => {
  try {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers = createAuthHeaders(options.headers as Record<string, string>, options.body);
    const fetchOptions: RequestInit = {
      ...options,
      headers: isFormData ? headers : { ...headers },
    };
    const response = await fetch(url, fetchOptions);
    if (response.status === 401) {
      if (sessionExpiredFn) {
        sessionExpiredFn();
      } else if (logoutFn) {
        logoutFn();
      }
      return null;
    }

    // Check for other error status codes
    if (!response.ok) {
      if (import.meta.env.DEV) {
        console.error(`API request failed with status: ${response.status}`);
      }
      // Still return the response so safeJsonParse can handle it
    }

    return response;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('API request failed:', error);
    }
    throw error;
  }
};

// Helper function to safely parse JSON response
const safeJsonParse = async (response: Response) => {
  try {
    const text = await response.text();
    if (!text) {
      return { success: false, message: 'Empty response' };
    }

    // Check if response is HTML (error page)
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      return {
        success: false,
        message: 'Server returned HTML instead of JSON. This usually indicates a server error.',
        status: response.status
      };
    }

    return JSON.parse(text);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('JSON parsing error:', error);
    }
    return {
      success: false,
      message: 'Invalid JSON response from server',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// API Service object with common HTTP methods
export const apiService = {
  // GET request
  get: async (endpoint: string, logoutFn?: () => void, sessionExpiredFn?: () => void) => {
    const url = joinUrl(API_BASE_URL, endpoint);
    const response = await fetchWithAuth(url, {
      method: 'GET'
    }, logoutFn, sessionExpiredFn);
    if (!response) return { success: false, message: 'No response received' };
    return await safeJsonParse(response);
  },

  // POST request
  post: async (endpoint: string, data: any, logoutFn?: () => void, sessionExpiredFn?: () => void) => {
    const url = joinUrl(API_BASE_URL, endpoint);
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const response = await fetchWithAuth(url, {
      method: 'POST',
      body: isFormData ? data : JSON.stringify(data),
      headers: isFormData ? undefined : undefined // let createAuthHeaders handle
    }, logoutFn, sessionExpiredFn);
    if (!response) return { success: false, message: 'No response received' };
    return await safeJsonParse(response);
  },

  // PUT request
  put: async (endpoint: string, data: any, logoutFn?: () => void, sessionExpiredFn?: () => void) => {
    const url = joinUrl(API_BASE_URL, endpoint);
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const response = await fetchWithAuth(url, {
      method: 'PUT',
      body: isFormData ? data : JSON.stringify(data),
      headers: isFormData ? undefined : undefined
    }, logoutFn, sessionExpiredFn);
    if (!response) return { success: false, message: 'No response received' };
    return await safeJsonParse(response);
  },

  // DELETE request
  delete: async (endpoint: string, logoutFn?: () => void, sessionExpiredFn?: () => void) => {
    const url = joinUrl(API_BASE_URL, endpoint);
    const response = await fetchWithAuth(url, {
      method: 'DELETE'
    }, logoutFn, sessionExpiredFn);
    if (!response) return { success: false, message: 'No response received' };
    return await safeJsonParse(response);
  },

  // PATCH request
  patch: async (endpoint: string, data: any, logoutFn?: () => void, sessionExpiredFn?: () => void) => {
    const url = joinUrl(API_BASE_URL, endpoint);
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const response = await fetchWithAuth(url, {
      method: 'PATCH',
      body: isFormData ? data : JSON.stringify(data),
      headers: isFormData ? undefined : undefined
    }, logoutFn, sessionExpiredFn);
    if (!response) return { success: false, message: 'No response received' };
    return await safeJsonParse(response);
  }
};

// Specific API endpoints for better organization
// ลบส่วนนี้ออก (ย้ายไป constants แล้ว)
// export const apiEndpoints = { ... }

// Export the fetchWithAuth function for backward compatibility
export { fetchWithAuth };
