/**
 * Utility Functions Index
 * Centralized export of all utility functions
 */

// Import all utility modules
const dateTimeUtils = require('./dateTimeUtils');
const authUtils = require('./authUtils');
const leaveUtils = require('./leaveUtils');
const responseUtils = require('./responseUtils');
const BaseController = require('./baseController');

// Export all utilities as a single object
module.exports = {
  // Date and Time utilities
  ...dateTimeUtils,
  
  // Authentication utilities
  ...authUtils,
  
  // Leave management utilities
  ...leaveUtils,
  
  // Response utilities
  ...responseUtils,
  
  // Base Controller
  BaseController
};

// Also export individual modules for specific imports
module.exports.dateTimeUtils = dateTimeUtils;
module.exports.authUtils = authUtils;
module.exports.leaveUtils = leaveUtils;
module.exports.responseUtils = responseUtils;
module.exports.BaseController = BaseController; 