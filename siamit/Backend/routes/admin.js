const express = require('express');
const router = express.Router();

// Admin and management routes
const positionController = require('../api/PositionController');
const departmentController = require('../api/DepartmentController');
const employeeController = require('../api/EmployeeController');
const superAdminController = require('../api/SuperAdminController');
const midController = require('../api/MidController');
const dashboardIndexController = require('../api/DashboardIndexController');
const announcementsController = require('../api/AnnouncementsController');
const customHolidayController = require('../api/CustomHolidayController');
const notificationBellController = require('../api/NotificationBellController');

const initializeAdminRoutes = (AppDataSource) => {
  // Position management
  router.use('/', positionController(AppDataSource));
  
  // Department management
  router.use('/', departmentController(AppDataSource));
  
  // Employee management
  router.use('/', employeeController(AppDataSource));
  
  // Super admin routes
  router.use('/', superAdminController(AppDataSource));
  
  // Mid controller (admin registration)
  router.use('/', midController(AppDataSource));
  
  // Dashboard
  router.use('/', dashboardIndexController(AppDataSource));
  
  // Announcements
  router.use('/', announcementsController(AppDataSource));
  
  // Custom holidays
  router.use('/', customHolidayController(AppDataSource));
  
  // Notifications
  router.use('/', notificationBellController(AppDataSource));
  
  return router;
};

module.exports = initializeAdminRoutes; 