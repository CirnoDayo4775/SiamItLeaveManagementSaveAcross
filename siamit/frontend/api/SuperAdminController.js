/**
 * @swagger
 * tags:
 *   name: SuperAdmin
 *   description: API for managing superadmins
 */

/**
 * @swagger
 * /api/superadmin:
 *   post:
 *     summary: Create a new superadmin
 *     tags: [SuperAdmin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Superadmin created successfully
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
 *       400:
 *         description: Duplicate name or email, or invalid department/position
 *       500:
 *         description: Internal server error
 *
 * /api/superadmin/{id}:
 *   delete:
 *     summary: Delete a superadmin by ID
 *     tags: [SuperAdmin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The superadmin's ID
 *     responses:
 *       200:
 *         description: Superadmin deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Superadmin not found
 *       500:
 *         description: Internal server error
 */
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { BaseController, sendSuccess, sendError, sendNotFound, sendValidationError } = require('../utils');
const { manualCleanup } = require('../utils/cleanupOldLeaveRequests');
const authMiddleware = require('../middleware/authMiddleware');

module.exports = (AppDataSource) => {
  const router = require('express').Router();
  // Create base controller instances
  const superadminController = new BaseController('User');
  const departmentController = new BaseController('Department');
  const positionController = new BaseController('Position');

  // Create superadmin
  router.post('/superadmin', async (req, res) => {
    try {
      const { name, email, password } = req.body;
      const userRepo = AppDataSource.getRepository('User');

      // Check for duplicate name
      const nameExist = await userRepo.findOneBy({ name });
      if (nameExist) {
        return sendValidationError(res, 'Superadmin name already exists');
      }

      // Check for duplicate email
      const emailExist = await userRepo.findOneBy({ Email: email });
      if (emailExist) {
        return sendValidationError(res, 'Email already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create JWT Token
      const superadminId = uuidv4();
      const token = jwt.sign(
        { userId: superadminId, email: email },
        config.server.jwtSecret,
        { expiresIn: config.server.jwtExpiresIn }
      );

      // Create superadmin in unified users table (only essential fields)
      const superadmin = userRepo.create({
        id: superadminId,
        name: name,
        Email: email,
        Password: hashedPassword,
        Token: token,
        Role: 'superadmin'
      });
      await userRepo.save(superadmin);

      sendSuccess(res, { 
        id: superadmin.id,
        name: superadmin.name,
        email: superadmin.Email,
        role: superadmin.Role,
        token: token
      }, 'Superadmin created successfully', 201);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY' && err.message.includes('Email')) {
        return sendValidationError(res, 'Email already exists');
      }
      if (err.code === 'ER_DUP_ENTRY' && err.message.includes('name')) {
        return sendValidationError(res, 'Superadmin name already exists');
      }
      sendError(res, err.message, 500);
    }
  });

  /**
   * @swagger
   * /api/create-user-with-role:
   *   post:
   *     summary: Create a user (admin, superadmin, or regular user) with a specified role
   *     tags: [SuperAdmin]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               role:
   *                 type: string
   *                 enum: [superadmin, admin, user]
   *               name:
   *                 type: string
   *               department:
   *                 type: string
   *               position:
   *                 type: string
   *               email:
   *                 type: string
   *               password:
   *                 type: string
   *     responses:
   *       201:
   *         description: User created successfully
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
   *       400:
   *         description: Invalid input or duplicate
   *       500:
   *         description: Internal server error
   */
  router.post('/create-user-with-role', async (req, res) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      const { role, name, department, position, email, password, gender_name_th, date_of_birth, start_work, end_work, phone_number } = req.body;
      if (!role || !['superadmin', 'admin', 'user'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing role' });
      }
      
      const processRepo = queryRunner.manager.getRepository('User');
      const departmentRepo = queryRunner.manager.getRepository('Department');
      const positionRepo = queryRunner.manager.getRepository('Position');
      // Gender is stored as a simple varchar in entities; no separate Gender table
      const genderValue = gender_name_th || null;
      // Check for duplicate email
      const exist = await processRepo.findOneBy({ Email: email });
      if (exist) {
        await queryRunner.rollbackTransaction();
        return res.status(400).json({ success: false, message: 'Email already exists' });
      }
      
      // Accept department as name or ID
      let departmentId = null;
      if (department) {
        const uuidRegex = /^[0-9a-fA-F-]{36}$/;
        if (uuidRegex.test(department)) {
          departmentId = department;
        } else {
          const deptEntity = await departmentRepo.findOne({ where: { department_name_th: department } });
          if (!deptEntity) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({ success: false, message: 'Department not found' });
          }
          departmentId = deptEntity.id;
        }
      }
      
      // Accept position as name or ID
      let positionId = null;
      if (position) {
        const uuidRegex = /^[0-9a-fA-F-]{36}$/;
        if (uuidRegex.test(position)) {
          positionId = position;
        } else {
          const posEntity = await positionRepo.findOne({ where: { position_name_th: position } });
          if (!posEntity) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({ success: false, message: 'Position not found' });
          }
          positionId = posEntity.id;
        }
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Check for duplicate name
      const nameExist = await processRepo.findOneBy({ name: name });
      if (nameExist) {
        await queryRunner.rollbackTransaction();
        return sendValidationError(res, 'Name already exists');
      }
      
      // Create JWT Token
      const userId = uuidv4();
      const token = jwt.sign(
        { userId: userId, email: email },
        config.server.jwtSecret,
        { expiresIn: config.server.jwtExpiresIn }
      );
      
      // Create user in unified users table (single row with all data)
      const user = processRepo.create({
        id: userId,
        name: name,
        Email: email,
        Password: hashedPassword,
        Token: token,
        Role: role,
        department: departmentId,
        position: positionId,
        gender: genderValue,
        dob: date_of_birth || null,
        start_work: start_work || null,
        end_work: end_work || null,
        phone_number: phone_number || null,
        avatar_url: null
      });
      await processRepo.save(user);
      
      await queryRunner.commitTransaction();
      
      sendSuccess(res, { ...user, token, repid: user.id }, 'User created successfully', 201);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error('Error creating user with role:', err);
      sendError(res, err.message, 500);
    } finally {
      await queryRunner.release();
    }
  });

  /**
   * @swagger
   * /api/positions-with-quotas:
   *   post:
   *     summary: Create a position and set leave quotas for all leave types (except emergency)
   *     tags: [SuperAdmin]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               position_name:
   *                 type: string
   *               quotas:
   *                 type: object
   *                 additionalProperties:
   *                   type: integer
   *                 description: Mapping of leave type name to quota number
   *     responses:
   *       201:
   *         description: Position and quotas created successfully
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
   *       400:
   *         description: Invalid input or duplicate
   *       500:
   *         description: Internal server error
   */
  router.post('/positions-with-quotas', async (req, res) => {
            const { position_name_en, position_name_th, quotas, require_enddate = false } = req.body;
    console.log('Received quotas:', quotas);
    if (!position_name_en || !position_name_th || typeof quotas !== 'object') {
      return sendValidationError(res, 'position_name_en, position_name_th, and quotas are required');
    }
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const positionRepo = queryRunner.manager.getRepository('Position');
      const leaveTypeRepo = queryRunner.manager.getRepository('LeaveType');
      const leaveQuotaRepo = queryRunner.manager.getRepository('LeaveQuota');
      // 1. Create position with both languages
              const position = positionRepo.create({ position_name_en, position_name_th, require_enddate: !!require_enddate });
      await positionRepo.save(position);
      // 2. Get all leave types except 'emergency'
      const leaveTypes = await leaveTypeRepo.find();
      const filteredLeaveTypes = leaveTypes.filter(
        lt => (lt.leave_type_en?.toLowerCase() !== 'emergency' && lt.leave_type_th?.toLowerCase() !== 'emergency')
      );
      // 3. Create leave quotas for each leave type
      const createdQuotas = [];
      for (const leaveType of filteredLeaveTypes) {
        const quota = quotas[leaveType.id] ?? 0;
        const leaveQuota = leaveQuotaRepo.create({ positionId: position.id, leaveTypeId: leaveType.id, quota });
        await leaveQuotaRepo.save(leaveQuota);
        createdQuotas.push({ leave_type_en: leaveType.leave_type_en, leave_type_th: leaveType.leave_type_th, quota });
      }
      await queryRunner.commitTransaction();
      res.status(201).json({
        success: true,
        data: { position, quotas: createdQuotas },
        message: 'Position and quotas created successfully'
      });
    } catch (err) {
      await queryRunner.rollbackTransaction();
      res.status(500).json({ success: false, message: err.message });
    } finally {
      await queryRunner.release();
    }
  });

  /**
   * @swagger
   * /api/positions-with-quotas:
   *   get:
   *     summary: Get all positions with their leave quotas
   *     tags: [SuperAdmin]
   *     responses:
   *       200:
   *         description: List of positions with quotas
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                 message:
   *                   type: string
   */
  router.get('/positions-with-quotas', async (req, res) => {
    try {
      const positionRepo = AppDataSource.getRepository('Position');
      const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
      const leaveQuotaRepo = AppDataSource.getRepository('LeaveQuota');
      const positions = await positionRepo.find();
      const leaveTypes = await leaveTypeRepo.find();
      const filteredLeaveTypes = leaveTypes.filter(
        lt => (lt.leave_type_en?.toLowerCase() !== 'emergency' && lt.leave_type_th?.toLowerCase() !== 'emergency')
      );
      const quotas = await leaveQuotaRepo.find();
      const result = positions.map(pos => {
        const posQuotas = filteredLeaveTypes.map(lt => {
          const quotaRow = quotas.find(q => q.positionId === pos.id && q.leaveTypeId === lt.id);
          return {
            leaveTypeId: lt.id,
            leave_type_en: lt.leave_type_en,
            leave_type_th: lt.leave_type_th,
            quota: quotaRow ? quotaRow.quota : 0,
            quotaId: quotaRow ? quotaRow.id : null
          };
        });
        return {
          id: pos.id,
          position_name_en: pos.position_name_en,
          position_name_th: pos.position_name_th,
                      require_enddate: !!pos.require_enddate,
          new_year_quota: typeof pos.new_year_quota === 'number' ? pos.new_year_quota : (pos.new_year_quota ? 1 : 0),
          quotas: posQuotas
        };
      });
      res.json({ success: true, data: result, message: 'Fetched all positions with quotas' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  /**
   * @swagger
   * /api/positions-with-quotas/{id}:
   *   put:
   *     summary: Update a position and its leave quotas
   *     tags: [SuperAdmin]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The position ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               position_name:
   *                 type: string
   *               quotas:
   *                 type: object
   *                 additionalProperties:
   *                   type: integer
   *                 description: Mapping of leave type name to quota number
   *     responses:
   *       200:
   *         description: Position and quotas updated successfully
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
   *       400:
   *         description: Invalid input
   *       404:
   *         description: Position not found
   *       500:
   *         description: Internal server error
   */
  router.put('/positions-with-quotas/:id', async (req, res) => {
    const { id } = req.params;
            const { position_name_en, position_name_th, quotas, require_enddate, new_year_quota } = req.body;
    if (!position_name_en || !position_name_th || typeof quotas !== 'object') {
      return res.status(400).json({ success: false, message: 'position_name_en, position_name_th, and quotas are required' });
    }
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const positionRepo = queryRunner.manager.getRepository('Position');
      const leaveTypeRepo = queryRunner.manager.getRepository('LeaveType');
      const leaveQuotaRepo = queryRunner.manager.getRepository('LeaveQuota');
      const position = await positionRepo.findOneBy({ id });
      if (!position) {
        await queryRunner.rollbackTransaction();
        return res.status(404).json({ success: false, message: 'Position not found' });
      }
      position.position_name_en = position_name_en;
      position.position_name_th = position_name_th;
              position.require_enddate = typeof require_enddate === 'boolean' ? require_enddate : !!position.require_enddate;
      if (new_year_quota !== undefined && new_year_quota !== null) {
        // Expect 0 = reset, 1 = not reset
        position.new_year_quota = Number(new_year_quota) === 1 ? 1 : 0;
      }
      await positionRepo.save(position);
      const leaveTypes = await leaveTypeRepo.find();
      const filteredLeaveTypes = leaveTypes.filter(
        lt => (lt.leave_type_en?.toLowerCase() !== 'emergency' && lt.leave_type_th?.toLowerCase() !== 'emergency')
      );
      const updatedQuotas = [];
      for (const leaveType of filteredLeaveTypes) {
        const quotaValue = quotas[leaveType.id] ?? 0;
        let quotaRow = await leaveQuotaRepo.findOneBy({ positionId: id, leaveTypeId: leaveType.id });
        if (quotaRow) {
          quotaRow.quota = quotaValue;
          await leaveQuotaRepo.save(quotaRow);
        } else {
          quotaRow = leaveQuotaRepo.create({ positionId: id, leaveTypeId: leaveType.id, quota: quotaValue });
          await leaveQuotaRepo.save(quotaRow);
        }
        updatedQuotas.push({ leave_type_en: leaveType.leave_type_en, leave_type_th: leaveType.leave_type_th, quota: quotaValue });
      }
      await queryRunner.commitTransaction();
      sendSuccess(res, { position, quotas: updatedQuotas }, 'Position and quotas updated successfully');
    } catch (err) {
      await queryRunner.rollbackTransaction();
      sendError(res, err.message, 500);
    } finally {
      await queryRunner.release();
    }
  });

  /**
   * @swagger
   * /api/positions-with-quotas/{id}:
   *   delete:
   *     summary: Delete a position and all its leave quotas
   *     tags: [SuperAdmin]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The position ID
   *     responses:
   *       200:
   *         description: Position and quotas deleted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *       404:
   *         description: Position not found
   *       500:
   *         description: Internal server error
   */
  router.delete('/positions-with-quotas/:id', async (req, res) => {
    const { id } = req.params;
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const positionRepo = queryRunner.manager.getRepository('Position');
      const leaveQuotaRepo = queryRunner.manager.getRepository('LeaveQuota');
      const position = await positionRepo.findOneBy({ id });
      if (!position) {
        await queryRunner.rollbackTransaction();
        return sendNotFound(res, 'Position not found');
      }
      await leaveQuotaRepo.delete({ positionId: id });
      await positionRepo.delete({ id });
      await queryRunner.commitTransaction();
      sendSuccess(res, null, 'Position and quotas deleted successfully');
    } catch (err) {
      await queryRunner.rollbackTransaction();
      sendError(res, err.message, 500);
    } finally {
      await queryRunner.release();
    }
  });

  // POST /api/superadmin/cleanup-old-leave-requests
  router.post('/superadmin/cleanup-old-leave-requests', authMiddleware, async (req, res) => {
    try {
      const result = await manualCleanup(AppDataSource);
      
      if (result.success) {
        sendSuccess(res, {
          deletedCount: result.deletedCount,
          message: result.message
        }, 'Cleanup completed successfully');
      } else {
        sendError(res, result.message, 500);
      }
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  // Add GET /api/superadmin to fetch all superadmins
  router.get('/superadmin', authMiddleware, async (req, res) => {
    try {
      const userRepo = AppDataSource.getRepository('User');
      const superadmins = await userRepo.find({ where: { Role: 'superadmin' } });
      // Return only id and name for dropdown
      const result = superadmins.map(sa => ({
        id: sa.id,
        name: sa.name,
        email: sa.Email || '',
      }));
      sendSuccess(res, result, 'Fetched all superadmins');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  // Delete superadmin
  router.delete('/superadmin/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const userRepo = AppDataSource.getRepository('User');
      const { deleteUserComprehensive } = require('../utils/userDeletionUtils');

      const result = await deleteUserComprehensive(AppDataSource, id, 'superadmin', userRepo);
      
      sendSuccess(res, result.deletionSummary, result.message);
    } catch (err) {
      if (err.message === 'superadmin not found') {
        return sendNotFound(res, 'Superadmin not found');
      }
      sendError(res, err.message, 500);
    }
  });

  return router;
}; 