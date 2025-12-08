/**
 * File Upload Middleware
 * Centralized file upload configuration using multer
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const sharp = require('sharp');

// Image MIME types handled by compression
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
const DEFAULT_IMAGE_TARGET_BYTES = parseInt(process.env.IMAGE_MAX_FILE_SIZE) || 1024; // 1KB default

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

  const upload = multer({
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

  // Helper: compress/convert a single image file to webp target size
  const compressFileToWebp = async (filePath, targetBytes) => {
    const dir = path.dirname(filePath);
    const base = path.basename(filePath, path.extname(filePath));
    const tmpOut = path.join(dir, base + '.webp');

    // Iteratively reduce quality and dimensions until target reached or limits hit
    let quality = 80;
    let metadata = await sharp(filePath).metadata();
    let width = metadata.width || null;
    let height = metadata.height || null;

    for (let attempt = 0; attempt < 10; attempt++) {
      let transformer = sharp(filePath).webp({ quality });
      if (width && height && attempt > 0) {
        // progressively downscale
        const scale = Math.pow(0.8, attempt);
        transformer = transformer.resize(Math.max(1, Math.round(width * scale)));
      }

      await transformer.toFile(tmpOut);
      const stats = fs.statSync(tmpOut);
      if (stats.size <= targetBytes) {
        return { outPath: tmpOut, size: stats.size };
      }

      // reduce quality for next attempt
      quality = Math.max(10, Math.floor(quality * 0.7));
    }

    // Final attempt: return last output even if larger than target
    const finalStats = fs.existsSync(tmpOut) ? fs.statSync(tmpOut) : null;
    return { outPath: tmpOut, size: finalStats ? finalStats.size : null };
  };

  // Post-process uploaded files (convert images to webp with target size)
  const postProcessFiles = async (req) => {
    const processSingle = async (file) => {
      if (!file || !file.path) return;
      if (!IMAGE_MIME_TYPES.includes(file.mimetype)) return; // only images

      const target = parseInt(process.env.IMAGE_MAX_FILE_SIZE) || DEFAULT_IMAGE_TARGET_BYTES;
      try {
        const { outPath, size } = await compressFileToWebp(file.path, target);
        if (outPath && fs.existsSync(outPath)) {
          // remove original file if different
          if (path.resolve(outPath) !== path.resolve(file.path)) {
            try { fs.unlinkSync(file.path); } catch (e) { /* ignore */ }
          }

          // Update file metadata so controllers see the webp file
          file.filename = path.basename(outPath);
          file.path = outPath;
          file.mimetype = 'image/webp';
        }
      } catch (e) {
        // If compression fails, leave original file and continue
        console.error('Image compression error:', e.message || e);
      }
    };

    if (req.file) {
      await processSingle(req.file);
    }

    if (req.files) {
      // multer may provide array or object
      if (Array.isArray(req.files)) {
        for (const f of req.files) await processSingle(f);
      } else if (typeof req.files === 'object') {
        // fields() returns object of arrays
        for (const key of Object.keys(req.files)) {
          const arr = req.files[key];
          if (Array.isArray(arr)) {
            for (const f of arr) await processSingle(f);
          }
        }
      }
    }
  };

  // Wrap multer methods so we can run post-processing after multer finishes
  const wrapper = {};
  ['single', 'array', 'fields', 'any'].forEach((method) => {
    wrapper[method] = function(...args) {
      const mw = upload[method](...args);
      return function(req, res, next) {
        mw(req, res, function(err) {
          if (err) return next(err);
          // run post-processing, but don't block error handling
          postProcessFiles(req).then(() => next()).catch(next);
        });
      };
    };
  });

  // expose storage and other props if needed
  wrapper._multer = upload;
  return wrapper;
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