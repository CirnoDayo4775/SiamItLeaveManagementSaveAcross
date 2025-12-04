/**
 * Response Utility Functions
 * Centralized utilities for standardizing API responses and error handling
 */

/**
 * Create success response
 * @param {any} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {Object} Standard success response
 */
const createSuccessResponse = (data, message = 'Success', statusCode = 200) => {
  return {
    success: true,
    data,
    message,
    statusCode
  };
};

/**
 * Create error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {any} data - Additional error data (optional)
 * @returns {Object} Standard error response
 */
const createErrorResponse = (message, statusCode = 500, data = null) => {
  return {
    success: false,
    data,
    message,
    statusCode
  };
};

/**
 * Create paginated response
 * @param {Array} data - Response data
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @param {string} message - Success message
 * @returns {Object} Paginated response
 */
const createPaginatedResponse = (data, page, limit, total, message = 'Success') => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    success: true,
    data,
    message,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
};

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {any} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json(createSuccessResponse(data, message, statusCode));
};

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {any} data - Additional error data (optional)
 */
const sendError = (res, message, statusCode = 500, data = null) => {
  res.status(statusCode).json(createErrorResponse(message, statusCode, data));
};

/**
 * Send paginated response
 * @param {Object} res - Express response object
 * @param {Array} data - Response data
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @param {string} message - Success message
 */
const sendPaginated = (res, data, page, limit, total, message = 'Success') => {
  res.json(createPaginatedResponse(data, page, limit, total, message));
};

/**
 * Handle async errors in route handlers
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function with error handling
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create validation error response
 * @param {Array} errors - Validation errors array
 * @returns {Object} Validation error response
 */
const createValidationError = (errors) => {
  return createErrorResponse('Validation failed', 400, { errors });
};

/**
 * Send validation error response
 * @param {Object} res - Express response object
 * @param {string|Array} errors - Validation error message or errors array
 */
const sendValidationError = (res, errors) => {
  // If errors is a string, wrap it in an array
  const errorArray = Array.isArray(errors) ? errors : [errors];
  res.status(400).json(createValidationError(errorArray));
};

/**
 * Create not found error response
 * @param {string} resource - Resource name
 * @returns {Object} Not found error response
 */
const createNotFoundError = (resource = 'Resource') => {
  return createErrorResponse(`${resource} not found`, 404);
};

/**
 * Send not found error response
 * @param {Object} res - Express response object
 * @param {string} resource - Resource name
 */
const sendNotFound = (res, resource = 'Resource') => {
  res.status(404).json(createNotFoundError(resource));
};

/**
 * Create unauthorized error response
 * @param {string} message - Error message
 * @returns {Object} Unauthorized error response
 */
const createUnauthorizedError = (message = 'Unauthorized') => {
  return createErrorResponse(message, 401);
};

/**
 * Send unauthorized error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
const sendUnauthorized = (res, message = 'Unauthorized') => {
  res.status(401).json(createUnauthorizedError(message));
};

/**
 * Create forbidden error response
 * @param {string} message - Error message
 * @returns {Object} Forbidden error response
 */
const createForbiddenError = (message = 'Forbidden') => {
  return createErrorResponse(message, 403);
};

/**
 * Send forbidden error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
const sendForbidden = (res, message = 'Forbidden') => {
  res.status(403).json(createForbiddenError(message));
};

/**
 * Create conflict error response
 * @param {string} message - Error message
 * @returns {Object} Conflict error response
 */
const createConflictError = (message = 'Conflict') => {
  return createErrorResponse(message, 409);
};

/**
 * Send conflict error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
const sendConflict = (res, message = 'Conflict') => {
  res.status(409).json(createConflictError(message));
};

module.exports = {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  sendSuccess,
  sendError,
  sendPaginated,
  asyncHandler,
  createValidationError,
  sendValidationError,
  createNotFoundError,
  sendNotFound,
  createUnauthorizedError,
  sendUnauthorized,
  createForbiddenError,
  sendForbidden,
  createConflictError,
  sendConflict
}; 