const express = require('express');
const router = express.Router();

// Authentication routes
const registerController = require('../api/RegisterController');
const loginController = require('../api/LoginController');
const profileController = require('../api/ProfileController');
const authMiddleware = require('../middleware/authMiddleware');

const initializeAuthRoutes = (AppDataSource) => {
  // Public auth routes
  router.use('/', registerController(AppDataSource));
  router.use('/', loginController(AppDataSource));
  
  // Protected profile routes
  router.use('/', profileController(AppDataSource));
  
  return router;
};

module.exports = initializeAuthRoutes; 