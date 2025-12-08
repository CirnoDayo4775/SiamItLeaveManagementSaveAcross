const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { BaseController, sendSuccess, sendError, sendNotFound, sendValidationError } = require('../utils');
const { manualCleanup } = require('../utils/cleanupOldLeaveRequests');
const { deleteUserComprehensive } = require('../utils/userDeletionUtils');
const authMiddleware = require('../middleware/authMiddleware');


module.exports = (AppDataSource) => {
  const router = require('express').Router();
  
  // --- Helper Functions ---

  /**
   * Helper to create a user with specified role and details
   */
  const createUser = async (userData, repo) => {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const userId = uuidv4();
    const token = jwt.sign(
      { userId, email: userData.email },
      config.server.jwtSecret,
      { expiresIn: config.server.jwtExpiresIn }
    );

    const user = repo.create({
      id: userId,
      name: userData.name,
      email: userData.email,
      password: hashedPassword,
      token: token,
      role: userData.role,
      department: userData.departmentId || null,
      position: userData.positionId || null,
      gender: userData.gender || null,
      dob: userData.dob || null,
      start_work: userData.start_work || null,
      end_work: userData.end_work || null,
      phone_number: userData.phone_number || null,
      avatar_url: null
    });

    await repo.save(user);
    return { ...user, token };
  };

  /**
   * Helper to resolve entity ID from Name or ID
   */
  const resolveEntityId = async (repo, identifier, fieldName) => {
    if (!identifier) return null;
    const uuidRegex = /^[0-9a-fA-F-]{36}$/;
    
    if (uuidRegex.test(identifier)) return identifier;
    
    const entity = await repo.findOne({ where: { [fieldName]: identifier } });
    return entity ? entity.id : null;
  };

  // --- Routes ---

  // Create Superadmin
  router.post('/superadmin', async (req, res) => {
    try {
      const { name, email, password } = req.body;
      const userRepo = AppDataSource.getRepository('User');

      // Check duplicates (Parallel)
      const [nameExist, emailExist] = await Promise.all([
        userRepo.findOneBy({ name }),
        userRepo.findOneBy({ Email: email })
      ]);

      if (nameExist) return sendValidationError(res, 'Superadmin name already exists');
      if (emailExist) return sendValidationError(res, 'Email already exists');

      const result = await createUser({ name, email, password, role: 'superadmin' }, userRepo);
      
      sendSuccess(res, { 
        id: result.id, 
        name: result.name, 
        email: result.Email, 
        role: result.Role, 
        token: result.token 
      }, 'Superadmin created successfully', 201);

    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  // Create User with specific role
  router.post('/create-user-with-role', async (req, res) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      const { role, name, department, position, email, password, gender_name_th, date_of_birth, start_work, end_work, phone_number } = req.body;
      
      if (!['superadmin', 'admin', 'user'].includes(role)) {
        return sendValidationError(res, 'Invalid role');
      }

      const userRepo = queryRunner.manager.getRepository('User');
      const deptRepo = queryRunner.manager.getRepository('Department');
      const posRepo = queryRunner.manager.getRepository('Position');

      // Check Duplicates
      const [emailExist, nameExist] = await Promise.all([
        userRepo.findOneBy({ Email: email }),
        userRepo.findOneBy({ name: name })
      ]);

      if (emailExist) return sendValidationError(res, 'Email already exists');
      if (nameExist) return sendValidationError(res, 'Name already exists');

      // Resolve IDs
      const [departmentId, positionId] = await Promise.all([
        resolveEntityId(deptRepo, department, 'department_name_th'),
        resolveEntityId(posRepo, position, 'position_name_th')
      ]);

      if (department && !departmentId) return sendNotFound(res, 'Department not found');
      if (position && !positionId) return sendNotFound(res, 'Position not found');

      const result = await createUser({
        name, email, password, role,
        departmentId, positionId,
        gender: gender_name_th,
        dob: date_of_birth,
        start_work, end_work, phone_number
      }, userRepo);

      await queryRunner.commitTransaction();
      sendSuccess(res, { ...result, repid: result.id }, 'User created successfully', 201);

    } catch (err) {
      await queryRunner.rollbackTransaction();
      sendError(res, err.message, 500);
    } finally {
      await queryRunner.release();
    }
  });

  // Create Position with Quotas
  router.post('/positions-with-quotas', async (req, res) => {
    const { position_name_en, position_name_th, quotas, require_enddate } = req.body;
    
    if (!position_name_en || !position_name_th || typeof quotas !== 'object') {
      return sendValidationError(res, 'Missing required fields');
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const posRepo = queryRunner.manager.getRepository('Position');
      const ltRepo = queryRunner.manager.getRepository('LeaveType');
      const lqRepo = queryRunner.manager.getRepository('LeaveQuota');

      // 1. Create Position
      const position = await posRepo.save(posRepo.create({
        position_name_en,
        position_name_th,
        require_enddate: !!require_enddate
      }));

      // 2. Fetch & Filter Leave Types
      const leaveTypes = await ltRepo.find();
      const targetTypes = leaveTypes.filter(lt => !lt.leave_type_en?.toLowerCase().includes('emergency'));

      // 3. Create Quotas
      const createdQuotas = [];
      for (const lt of targetTypes) {
        const quotaVal = quotas[lt.id] ?? 0;
        await lqRepo.save(lqRepo.create({ positionId: position.id, leaveTypeId: lt.id, quota: quotaVal }));
        createdQuotas.push({ en: lt.leave_type_en, th: lt.leave_type_th, quota: quotaVal });
      }

      await queryRunner.commitTransaction();
      sendSuccess(res, { position, quotas: createdQuotas }, 'Created successfully', 201);

    } catch (err) {
      await queryRunner.rollbackTransaction();
      sendError(res, err.message, 500);
    } finally {
      await queryRunner.release();
    }
  });

  // Get Positions with Quotas
  router.get('/positions-with-quotas', async (req, res) => {
    try {
      const posRepo = AppDataSource.getRepository('Position');
      const ltRepo = AppDataSource.getRepository('LeaveType');
      const lqRepo = AppDataSource.getRepository('LeaveQuota');

      const [positions, leaveTypes, allQuotas] = await Promise.all([
        posRepo.find(),
        ltRepo.find(),
        lqRepo.find()
      ]);

      const targetTypes = leaveTypes.filter(lt => !lt.leave_type_en?.toLowerCase().includes('emergency'));

      const result = positions.map(pos => {
        const posQuotas = targetTypes.map(lt => {
          const q = allQuotas.find(q => q.positionId === pos.id && q.leaveTypeId === lt.id);
          return {
            leaveTypeId: lt.id,
            leave_type_en: lt.leave_type_en,
            leave_type_th: lt.leave_type_th,
            quota: q ? q.quota : 0,
            quotaId: q ? q.id : null
          };
        });

        return {
          id: pos.id,
          position_name_en: pos.position_name_en,
          position_name_th: pos.position_name_th,
          require_enddate: !!pos.require_enddate,
          new_year_quota: Number(pos.new_year_quota || 0),
          quotas: posQuotas
        };
      });

      sendSuccess(res, result, 'Fetched successfully');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  // Update Position with Quotas
  router.put('/positions-with-quotas/:id', async (req, res) => {
    const { id } = req.params;
    const { position_name_en, position_name_th, quotas, require_enddate, new_year_quota } = req.body;

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const posRepo = queryRunner.manager.getRepository('Position');
      const ltRepo = queryRunner.manager.getRepository('LeaveType');
      const lqRepo = queryRunner.manager.getRepository('LeaveQuota');

      const position = await posRepo.findOneBy({ id });
      if (!position) return sendNotFound(res, 'Position not found');

      // Update Position
      if (position_name_en) position.position_name_en = position_name_en;
      if (position_name_th) position.position_name_th = position_name_th;
      if (require_enddate !== undefined) position.require_enddate = require_enddate;
      if (new_year_quota !== undefined) position.new_year_quota = Number(new_year_quota) === 1 ? 1 : 0;
      
      await posRepo.save(position);

      // Update Quotas
      const leaveTypes = await ltRepo.find();
      const targetTypes = leaveTypes.filter(lt => !lt.leave_type_en?.toLowerCase().includes('emergency'));
      const updatedQuotas = [];

      for (const lt of targetTypes) {
        const val = quotas[lt.id] ?? 0;
        let q = await lqRepo.findOneBy({ positionId: id, leaveTypeId: lt.id });
        
        if (q) {
          q.quota = val;
          await lqRepo.save(q);
        } else {
          await lqRepo.save(lqRepo.create({ positionId: id, leaveTypeId: lt.id, quota: val }));
        }
        updatedQuotas.push({ id: lt.id, quota: val });
      }

      await queryRunner.commitTransaction();
      sendSuccess(res, { position, quotas: updatedQuotas }, 'Updated successfully');

    } catch (err) {
      await queryRunner.rollbackTransaction();
      sendError(res, err.message, 500);
    } finally {
      await queryRunner.release();
    }
  });

  // Delete Position and Quotas
  router.delete('/positions-with-quotas/:id', async (req, res) => {
    const { id } = req.params;
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const posRepo = queryRunner.manager.getRepository('Position');
      const lqRepo = queryRunner.manager.getRepository('LeaveQuota');

      const position = await posRepo.findOneBy({ id });
      if (!position) return sendNotFound(res, 'Position not found');

      await lqRepo.delete({ positionId: id });
      await posRepo.delete({ id });

      await queryRunner.commitTransaction();
      sendSuccess(res, null, 'Deleted successfully');
    } catch (err) {
      await queryRunner.rollbackTransaction();
      sendError(res, err.message, 500);
    } finally {
      await queryRunner.release();
    }
  });

  // Cleanup Old Leave Requests
  router.post('/superadmin/cleanup-old-leave-requests', authMiddleware, async (req, res) => {
    try {
      const result = await manualCleanup(AppDataSource);
      result.success 
        ? sendSuccess(res, { deletedCount: result.deletedCount }, result.message)
        : sendError(res, result.message, 500);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  // Get Superadmins
  router.get('/superadmin', authMiddleware, async (req, res) => {
    try {
      const users = await AppDataSource.getRepository('User').find({ where: { Role: 'superadmin' } });
      const result = users.map(u => ({ id: u.id, name: u.name, email: u.Email || '' }));
      sendSuccess(res, result, 'Fetched superadmins');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  // Delete Superadmin
  router.delete('/superadmin/:id', authMiddleware, async (req, res) => {
    try {
      const result = await deleteUserComprehensive(AppDataSource, req.params.id, 'superadmin', AppDataSource.getRepository('User'));
      sendSuccess(res, result.deletionSummary, result.message);
    } catch (err) {
      if (err.message === 'superadmin not found') return sendNotFound(res, 'Superadmin not found');
      sendError(res, err.message, 500);
    }
  });

  return router;
};