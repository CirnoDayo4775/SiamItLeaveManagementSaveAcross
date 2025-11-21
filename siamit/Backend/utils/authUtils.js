/**
 * Authentication Utility Functions
 * Centralized utilities for JWT operations and password handling
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');

/**
 * Hash password with bcrypt
 * @param {string} password - Plain text password
 * @param {number} saltRounds - Salt rounds (default: 10)
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password, saltRounds = 10) => {
  return await bcrypt.hash(password, saltRounds);
};

/**
 * Compare password with hashed password
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password to compare against
 * @returns {Promise<boolean>} True if passwords match
 */
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

/**
 * Generate JWT token
 * @param {Object} payload - Token payload
 * @param {string} secret - JWT secret (optional, uses config default)
 * @param {string} expiresIn - Token expiration (optional, uses config default)
 * @returns {string} JWT token
 */
const generateToken = (payload, secret = config.server.jwtSecret, expiresIn = config.server.jwtExpiresIn) => {
  return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @param {string} secret - JWT secret (optional, uses config default)
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token, secret = config.server.jwtSecret) => {
  return jwt.verify(token, secret);
};

/**
 * Generate user token with standard payload
 * @param {Object} user - User object
 * @param {string} email - User email
 * @returns {string} JWT token
 */
const generateUserToken = (user, email) => {
  return generateToken({ userId: user.id, email });
};

/**
 * Generate admin token with role
 * @param {Object} user - User object
 * @param {string} role - User role
 * @returns {string} JWT token
 */
const generateAdminToken = (user, role) => {
  return generateToken({ userId: user.id, role });
};

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header
 * @returns {string|null} Token or null if not found
 */
const extractTokenFromHeader = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate UUID format
 * @param {string} uuid - UUID to validate
 * @returns {boolean} True if valid UUID format
 */
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-fA-F-]{36}$/;
  return uuidRegex.test(uuid);
};

/**
 * Create standard error response for authentication failures
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 401)
 * @returns {Object} Standard error response
 */
const createAuthError = (message = 'Authentication failed', statusCode = 401) => {
  return {
    success: false,
    data: null,
    message,
    statusCode
  };
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  generateUserToken,
  generateAdminToken,
  extractTokenFromHeader,
  isValidEmail,
  isValidUUID,
  createAuthError
}; 