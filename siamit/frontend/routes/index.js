const express = require('express');
const router = express.Router();

// Import modular route files
const authRoutes = require('./auth');
const leaveRoutes = require('./leave');
const adminRoutes = require('./admin');
const lineRoutes = require('./line');

// Initialize all routes with AppDataSource
const initializeRoutes = (AppDataSource) => {
  // Authentication routes
  router.use('/', authRoutes(AppDataSource));
  
  // Leave management routes
  router.use('/', leaveRoutes(AppDataSource));
  
  // Admin and management routes
  router.use('/', adminRoutes(AppDataSource));
  
  // LINE integration routes
  router.use('/', lineRoutes(AppDataSource));
  
  return router;
};

module.exports = initializeRoutes; 