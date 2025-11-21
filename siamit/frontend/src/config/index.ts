// Application configuration constants

// Environment variables with fallbacks
export const config = {
  // API Configuration
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
    timeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '10000'),
    retryAttempts: parseInt(import.meta.env.VITE_API_RETRY_ATTEMPTS || '3'),
  },

  // Application Configuration
  app: {
    name: import.meta.env.VITE_APP_NAME || 'SiamIT Leave Management',
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    environment: import.meta.env.MODE || 'development',
    debug: import.meta.env.VITE_DEBUG === 'true',
  },

  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(import.meta.env.VITE_MAX_FILE_SIZE || '10485760'), // 10MB
    allowedTypes: (import.meta.env.VITE_ALLOWED_FILE_TYPES || 'jpg,jpeg,png,pdf,doc,docx').split(','),
    uploadPath: import.meta.env.VITE_UPLOAD_PATH || '/uploads',
    publicPath: import.meta.env.VITE_PUBLIC_PATH || '/public',
  },

  // Assets Configuration
  assets: {
    defaultAvatar: '/lovable-uploads/siamit.png',
    logo: '/lovable-uploads/siamit.png',
    favicon: '/favicon.ico',
  },

  // Authentication Configuration
  auth: {
    tokenKey: import.meta.env.VITE_TOKEN_KEY || 'token',
    refreshTokenKey: import.meta.env.VITE_REFRESH_TOKEN_KEY || 'refreshToken',
    tokenExpiry: parseInt(import.meta.env.VITE_TOKEN_EXPIRY || '3600000'), // 1 hour
    refreshTokenExpiry: parseInt(import.meta.env.VITE_REFRESH_TOKEN_EXPIRY || '86400000'), // 24 hours
  },

  // UI Configuration
  ui: {
    theme: import.meta.env.VITE_THEME || 'system',
    language: import.meta.env.VITE_LANGUAGE || 'th',
    dateFormat: import.meta.env.VITE_DATE_FORMAT || 'DD/MM/YYYY',
    timeFormat: import.meta.env.VITE_TIME_FORMAT || 'HH:mm',
    timezone: import.meta.env.VITE_TIMEZONE || 'Asia/Bangkok',
  },

  // Notification Configuration
  notifications: {
    position: import.meta.env.VITE_NOTIFICATION_POSITION || 'top-right',
    duration: parseInt(import.meta.env.VITE_NOTIFICATION_DURATION || '5000'),
    maxVisible: parseInt(import.meta.env.VITE_MAX_NOTIFICATIONS || '5'),
  },

  // Pagination Configuration
  pagination: {
    defaultPageSize: parseInt(import.meta.env.VITE_DEFAULT_PAGE_SIZE || '10'),
    maxPageSize: parseInt(import.meta.env.VITE_MAX_PAGE_SIZE || '100'),
    pageSizeOptions: [10, 20, 50, 100],
  },

  // Feature Flags
  features: {
    enableNotifications: import.meta.env.VITE_ENABLE_NOTIFICATIONS !== 'false',
    enableFileUpload: import.meta.env.VITE_ENABLE_FILE_UPLOAD !== 'false',
    enableRealTime: import.meta.env.VITE_ENABLE_REAL_TIME !== 'false',
    enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  },
} as const;

// Helper function to get environment variable with type safety
export const getEnvVar = <T>(key: string, defaultValue: T, transformer?: (value: string) => T): T => {
  const value = import.meta.env[key];
  if (value === undefined) return defaultValue;
  
  if (transformer) {
    try {
      return transformer(value);
    } catch (error) {
      console.warn(`Failed to parse environment variable ${key}:`, error);
      return defaultValue;
    }
  }
  
  return value as T;
};

// Helper function to check if we're in development mode
export const isDevelopment = config.app.environment === 'development';

// Helper function to check if we're in production mode
export const isProduction = config.app.environment === 'production';

// Helper function to get API URL with path
export const getApiUrl = (path: string): string => {
  const baseUrl = config.api.baseUrl.replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  return `${baseUrl}/${cleanPath}`;
};

// Helper function to get upload URL
export const getUploadUrl = (filename: string): string => {
  const baseUrl = config.api.baseUrl.replace(/\/$/, '');
  const uploadPath = config.upload.uploadPath.replace(/^\//, '');
  return `${baseUrl}/${uploadPath}/${filename}`;
};

// Helper function to get public URL
export const getPublicUrl = (filename: string): string => {
  const baseUrl = config.api.baseUrl.replace(/\/$/, '');
  const publicPath = config.upload.publicPath.replace(/^\//, '');
  return `${baseUrl}/${publicPath}/${filename}`;
};
