const express = require('express');
const { BaseController, sendSuccess, sendError, sendNotFound, sendValidationError } = require('../utils');

module.exports = (AppDataSource) => {
  const router = express.Router();
  // Create base controller instances
  const userController = new BaseController('User');
  const adminController = new BaseController('User');

  /**
   * @swagger
   * tags:
   *   name: Users
   *   description: จัดการข้อมูล User
   */
  /**
   * @swagger
   * /users:
   *   get:
   *     summary: แสดง user ทั้งหมด
   *     tags: [Users]
   *     responses:
   *       200:
   *         description: รายการ user
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       name:
   *                         type: string
   *                       department:
   *                         type: string
   *                       position:
   *                         type: string
   *                 message:
   *                   type: string
   */
  router.get('/users', async (req, res) => {
    try {
      const users = await userController.findAll(AppDataSource);
      sendSuccess(res, users, 'Fetch users success');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  /**
   * @swagger
   * /users:
   *   post:
   *     summary: สร้าง user ใหม่
   *     tags: [Users]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               department:
   *                 type: string
   *               position:
   *                 type: string
   *     responses:
   *       201:
   *         description: สร้าง user สำเร็จ
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                     name:
   *                       type: string
   *                     department:
   *                       type: string
   *                     position:
   *                       type: string
   *                 message:
   *                   type: string
   */
  router.post('/users', async (req, res) => {
    try {
      const { name, department, position } = req.body;
      const user = await userController.create(AppDataSource, { name, department, position });
      sendSuccess(res, user, 'Create user success', 201);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  /**
   * @swagger
   * /users/{id}:
   *   delete:
   *     summary: ลบ user ตาม id
   *     tags: [Users]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: รหัส user
   *     responses:
   *       200:
   *         description: ลบ user สำเร็จ
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                 message:
   *                   type: string
   *       404:
   *         description: ไม่พบ user
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                 message:
   *                   type: string
   */
  router.delete('/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const userRepo = AppDataSource.getRepository('User');
      const { deleteUserComprehensive } = require('../utils/userDeletionUtils');

      const result = await deleteUserComprehensive(AppDataSource, id, 'user', userRepo);
      
      sendSuccess(res, result.deletionSummary, result.message);
    } catch (err) {
      if (err.message === 'user not found') {
        return sendNotFound(res, 'User not found');
      }
      sendError(res, err.message, 500);
    }
  });

  /**
   * @swagger
   * tags:
   *   name: Admins
   *   description: จัดการข้อมูล Admin
   */
  /**
   * @swagger
   * /admins:
   *   get:
   *     summary: แสดง admin ทั้งหมด
   *     tags: [Admins]
   *     responses:
   *       200:
   *         description: รายการ admin
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       name:
   *                         type: string
   *                       department:
   *                         type: string
   *                       position:
   *                         type: string
   *                 message:
   *                   type: string
   */
  router.get('/admins', async (req, res) => {
    try {
      // Get users with admin or superadmin role from unified User table
      const userRepo = AppDataSource.getRepository('User');
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

  /**
   * @swagger
   * /api/admins/register:
   *   post:
   *     summary: สร้างแอดมินใหม่
   *     tags: [Admins]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *               password:
   *                 type: string
   *               name:
   *                 type: string
   *               department:
   *                 type: string
   *               position:
   *                 type: string
   *     responses:
   *       201:
   *         description: สร้างแอดมินสำเร็จ
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                 message:
   *                   type: string
   */
  const { v4: uuidv4 } = require('uuid');
  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  const config = require('../config');

  router.post('/admins/register', async (req, res) => {
    try {
      const { email, password, name, department, position } = req.body;
      const processRepo = AppDataSource.getRepository('User');

      // ตรวจสอบ email ซ้ำ
      const exist = await processRepo.findOneBy({ Email: email });
      if (exist) {
        return sendValidationError(res, 'Email already exists');
      }

      // hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // สร้าง JWT Token
      const adminId = uuidv4();
      const token = jwt.sign(
        { adminId: adminId, email: email },
        config.server.jwtSecret,
        { expiresIn: config.server.jwtExpiresIn }
      );

      // สร้าง admin ใน unified users table (single row with all data)
      const admin = processRepo.create({
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
      await processRepo.save(admin);

      sendSuccess(res, { ...admin, token, repid: admin.id }, 'Create admin success', 201);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  /**
   * @swagger
   * /admins/{id}:
   *   delete:
   *     summary: ลบ admin ตาม id
   *     tags: [Admins]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: รหัส admin
   *     responses:
   *       200:
   *         description: ลบ admin สำเร็จ
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                 message:
   *                   type: string
   *       404:
   *         description: ไม่พบ admin
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                 message:
   *                   type: string
   */
  router.delete('/admins/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { deleteUserComprehensive } = require('../utils/userDeletionUtils');
      const adminRepo = AppDataSource.getRepository('User'); // Admin users are stored in User table

      const result = await deleteUserComprehensive(AppDataSource, id, 'admin', adminRepo);
      
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