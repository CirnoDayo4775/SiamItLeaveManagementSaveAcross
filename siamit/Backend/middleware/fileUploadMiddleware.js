/**
 * File Upload Middleware
 * Centralized file upload configuration using multer
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');

/**
 * Create multer storage configuration
 * @param {string} destination - Upload destination path
 * @param {string} filenamePrefix - Prefix for generated filenames
 * @returns {Object} Multer storage configuration
 */
const createStorage = (destination, filenamePrefix = '') => {
  return multer.diskStorage({
    destination: function (req, file, cb) {
      // Create directory if it doesn't exist
      if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
      }
      cb(null, destination);
    },
    filename: function (req, file, cb) {
      // Generate unique filename with timestamp
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const prefix = filenamePrefix ? `${filenamePrefix}-` : '';
      // Ensure file has an extension; derive from mimetype if missing
      const mimeToExt = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'application/pdf': '.pdf',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
      };
      let ext = path.extname(file.originalname || '');
      if (!ext || ext === '.') {
        ext = mimeToExt[file.mimetype] || '';
      }
      const safeExt = ext && ext.startsWith('.') ? ext : (ext ? `.${ext}` : '');
      cb(null, prefix + uniqueSuffix + safeExt);
    }
  });
};

/**
 * Create multer upload configuration
 * @param {Object} options - Upload options
 * @returns {Object} Multer upload instance
 */
const createUpload = (options = {}) => {
  const {
    destination,
    filenamePrefix = '',
    maxFileSize = config.uploads.maxFileSize,
    allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    maxFiles = 10
  } = options;

  const storage = createStorage(destination, filenamePrefix);

  return multer({
    storage: storage,
    limits: {
      fileSize: maxFileSize,
      files: maxFiles
    },
    fileFilter: function (req, file, cb) {
      // Check file type
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`), false);
      }
    }
  });
};

/**
 * Avatar upload middleware
 */
const avatarUpload = createUpload({
  destination: config.getAvatarsUploadPath(),
  filenamePrefix: 'avatar',
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif'],
  maxFiles: 1
});

/**
 * Leave request attachments upload middleware
 */
const leaveAttachmentsUpload = createUpload({
  destination: config.getLeaveUploadsPath(),
  allowedMimeTypes: [
    'image/jpeg', 
    'image/png', 
    'image/gif', 
    'application/pdf', 
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  maxFiles: 10
});

/**
 * Announcement image upload middleware
 */
const announcementImageUpload = createUpload({
  destination: config.getAnnouncementsUploadPath(),
  filenamePrefix: 'announcement',
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif'],
  maxFiles: 1
});

/**
 * Generic file upload middleware
 * @param {Object} options - Upload options
 * @returns {Function} Multer middleware
 */
const createFileUpload = (options) => {
  return createUpload(options);
};

/**
 * Error handling middleware for file uploads
 * @param {Error} error - Upload error
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum 5MB allowed.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 10 files allowed.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field.'
      });
    }
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  return res.status(500).json({
    success: false,
    message: 'File upload error'
  });
};

module.exports = {
  avatarUpload,
  leaveAttachmentsUpload,
  announcementImageUpload,
  createFileUpload,
  handleUploadError,
  createStorage,
  createUpload
}; 