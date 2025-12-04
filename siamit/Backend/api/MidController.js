const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { BaseController, sendSuccess, sendError, sendNotFound, sendValidationError } = require('../utils');
const { deleteUserComprehensive } = require('../utils/userDeletionUtils');



module.exports = (AppDataSource) => {
  const router = express.Router();
  
  // Single base controller for User entity (handles both users and admins)
  const userController = new BaseController('User');
  const userRepo = AppDataSource.getRepository('User');

  // --- Helper Functions ---

  const validateUserBody = (body) => {
    const { name, department, position } = body;
    if (!name || !department || !position) {
      return 'Name, department, and position are required';
    }
    return null;
  };

  const validateAdminBody = (body) => {
    const { email, password, name } = body;
    if (!email || !password || !name) {
      return 'Email, password, and name are required';
    }
    return null;
  };

  // --- User Routes ---


  router.get('/users', async (req, res) => {
    try {
      const users = await userController.findAll(AppDataSource);
      sendSuccess(res, users, 'Fetch users success');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });


  router.post('/users', async (req, res) => {
    try {
      const error = validateUserBody(req.body);
      if (error) return sendValidationError(res, error);

      const { name, department, position } = req.body;
      const user = await userController.create(AppDataSource, { name, department, position });
      sendSuccess(res, user, 'Create user success', 201);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });


  router.delete('/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await deleteUserComprehensive(AppDataSource, id, 'user', userRepo);
      sendSuccess(res, result.deletionSummary, result.message);
    } catch (err) {
      if (err.message === 'user not found') {
        return sendNotFound(res, 'User not found');
      }
      sendError(res, err.message, 500);
    }
  });

  // --- Admin Routes ---


  router.get('/admins', async (req, res) => {
    try {
      const admins = await userRepo.find({
        where: [
          { Role: 'admin' },
          { Role: 'superadmin' }
        ]
      });
      sendSuccess(res, admins, 'Fetch admins success');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

 
  router.post('/admins/register', async (req, res) => {
    try {
      const error = validateAdminBody(req.body);
      if (error) return sendValidationError(res, error);

      const { email, password, name, department, position } = req.body;

      // Check duplicate email
      const exist = await userRepo.findOneBy({ Email: email });
      if (exist) return sendValidationError(res, 'Email already exists');

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create Token
      const adminId = uuidv4();
      const token = jwt.sign(
        { adminId, email },
        config.server.jwtSecret,
        { expiresIn: config.server.jwtExpiresIn }
      );

      // Create Admin Entity
      const admin = userRepo.create({
        id: adminId,
        name,
        Email: email,
        Password: hashedPassword,
        Token: token,
        Role: 'admin',
        department,
        position,
        avatar_url: null
      });

      await userRepo.save(admin);

      sendSuccess(res, { ...admin, token, repid: admin.id }, 'Create admin success', 201);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

 
  router.delete('/admins/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await deleteUserComprehensive(AppDataSource, id, 'admin', userRepo);
      sendSuccess(res, result.deletionSummary, result.message);
    } catch (err) {
      if (err.message === 'admin not found') {
        return sendNotFound(res, 'Admin not found');
      }
      sendError(res, err.message, 500);
    }
  });

  return router;
};