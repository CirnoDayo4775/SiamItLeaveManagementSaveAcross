const path = require('path');
require('dotenv').config();

const config = {
  // Database Configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'siamitleave',
    type: process.env.DB_TYPE || 'mysql',
  },

  // File Upload Configuration
  uploads: {
    baseDir: process.env.UPLOADS_BASE_DIR || 'uploads',
    announcements: process.env.ANNOUNCEMENTS_UPLOAD_DIR || 'announcements',
    avatars: process.env.AVATARS_UPLOAD_DIR || 'avatars',
    leaveUploads: process.env.LEAVE_UPLOADS_DIR || 'leave-uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
  },

  // Server Configuration
  server: {
    port: process.env.PORT,
    jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret_here',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    apiBaseUrl: process.env.VITE_API_BASE_URL || 'https://api-leave-management.flowmisite.com/',
  },

  // CORS Configuration
  cors: {
    origins: process.env.CORS_ORIGINS ? 
      process.env.CORS_ORIGINS.split(',') : 
      [
        'http://localhost:8081',
        'https://api-leave-management.flowmisite.com/',
        'http://localhost:3001',
        'http://localhost:8080',
      ]
  },

  // Pagination Configuration
  pagination: {
    defaultLimit:  6,
    maxLimit: 50,
  },

  // Application Configuration
  app: {
    title: 'SiamITLeave API',
    version: '1.0.0',
  },

  // Business Logic Configuration
  business: {
    maxLeaveDays: parseInt(process.env.MAX_LEAVE_DAYS) || 20,
    workingHoursPerDay: parseInt(process.env.WORKING_HOURS_PER_DAY) || 9,
    workingStartHour: parseInt(process.env.WORKING_START_HOUR) || 9,
    workingEndHour: parseInt(process.env.WORKING_END_HOUR) || 18,
    minDate: process.env.MIN_DATE || '2000-01-01',
    maxDate: process.env.MAX_DATE || '3000-01-01',
  },

  // Helper methods for paths
  getUploadsPath: (subDir = '') => {
    const basePath = path.join(__dirname, config.uploads.baseDir);
    return subDir ? path.join(basePath, subDir) : basePath;
  },

  getAnnouncementsUploadPath: () => {
    return config.getUploadsPath(config.uploads.announcements);
  },

  getAvatarsUploadPath: () => {
    return config.getUploadsPath(config.uploads.avatars);
  },

  getLeaveUploadsPath: () => {
    return config.getUploadsPath(config.uploads.leaveUploads);
  }
};

module.exports = config; 