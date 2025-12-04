const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { BaseController, sendSuccess, sendError, sendValidationError } = require('../utils');

module.exports = (AppDataSource) => {
  const router = require('express').Router();
  
  // Base controllers
  const departmentController = new BaseController('Department');
  const positionController = new BaseController('Position');
  
  // Repository
  const userRepo = AppDataSource.getRepository('User');

  // --- Helper Functions ---

  /**
   * Helper to resolve entity ID from controller
   */
  const resolveEntity = async (controller, id, nameForError) => {
    if (!id || !id.trim()) return null;
    try {
      const entity = await controller.findOne(AppDataSource, id);
      if (!entity) throw new Error(`${nameForError} not found`);
      return entity.id;
    } catch (e) {
      console.error(`${nameForError} lookup error:`, e.message);
      throw new Error(`ไม่สามารถตรวจสอบ${nameForError}ได้ กรุณาลองใหม่`);
    }
  };

  /**
   * Helper to check duplicates
   */
  const checkDuplicates = async (name, email) => {
    // Parallel check for performance
    const [nameExist, emailExist] = await Promise.all([
      userRepo.findOneBy({ name }),
      userRepo.findOneBy({ Email: email })
    ]);

    if (nameExist) return `ชื่อ "${name}" ถูกใช้ไปแล้ว กรุณาใช้ชื่ออื่น`;
    if (emailExist) return `อีเมล "${email}" ถูกใช้ไปแล้ว กรุณาใช้อีเมลอื่น`;
    return null;
  };

  // --- Routes ---

  router.post('/register', async (req, res) => {
    try {
      const { name, department, position, email, password, gender, dob, phone_number, start_work, end_work } = req.body;

      // 1. Basic Validation
      const missingFields = [];
      if (!name) missingFields.push('ชื่อ');
      if (!email) missingFields.push('อีเมล');
      if (!password) missingFields.push('รหัสผ่าน');
      
      if (missingFields.length > 0) {
        return sendValidationError(res, `กรุณากรอกข้อมูลที่จำเป็น: ${missingFields.join(', ')}`);
      }

      // 2. Duplicate Check
      const duplicateError = await checkDuplicates(name, email);
      if (duplicateError) return sendValidationError(res, duplicateError);

      // 3. Resolve Relations (Department & Position)
      let departmentId = null;
      let positionId = null;
      
      try {
        [departmentId, positionId] = await Promise.all([
          resolveEntity(departmentController, department, 'แผนก'),
          resolveEntity(positionController, position, 'ตำแหน่ง')
        ]);
      } catch (err) {
        return sendValidationError(res, err.message);
      }

      // 4. Create User
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();
      const token = jwt.sign(
        { userId, email },
        config.server.jwtSecret,
        { expiresIn: config.server.jwtExpiresIn }
      );

      const userData = {
        id: userId,
        name,
        Email: email,
        Password: hashedPassword,
        Token: token,
        Role: 'user', // Default role
        department: departmentId,
        position: positionId,
        gender: gender || null,
        dob: dob || null,
        phone_number: phone_number || null,
        start_work: start_work || null,
        end_work: (end_work && end_work.trim() !== 'undefined') ? end_work : null,
        avatar_url: null
      };

      const newUser = userRepo.create(userData);
      await userRepo.save(newUser);

      // 5. Response (Hide sensitive data)
      const responseData = { ...newUser, token, repid: newUser.id };
      delete responseData.Password;
      // delete responseData.Token; // Token is sent separately, usually keep in response for immediate login

      sendSuccess(res, responseData, 'Register successful', 201);

    } catch (err) {
      console.error('Registration error:', err);

      // Handle specific database errors
      if (err.code === 'ER_DUP_ENTRY') {
        if (err.message.includes('Email')) return sendValidationError(res, 'Email นี้ถูกใช้ไปแล้ว');
        if (err.message.includes('name')) return sendValidationError(res, 'ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว');
      }
      if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return sendValidationError(res, 'แผนกหรือตำแหน่งที่เลือกไม่ถูกต้อง กรุณาเลือกใหม่');
      }

      sendError(res, err.message, 500);
    }
  });

  return router;
};