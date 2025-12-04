const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { BaseController, sendSuccess, sendError, sendValidationError } = require('../utils');

module.exports = (AppDataSource) => {
  const router = require('express').Router();
  // Create base controller instances
  const userController = new BaseController('User');
  const departmentController = new BaseController('Department');
  const positionController = new BaseController('Position');

  router.post('/register', async (req, res) => {
    try {
      const { name, department, position, email, password, gender, dob, phone_number, start_work, end_work } = req.body;
      
      // Debug logging
      console.log('Registration request data:', { name, department, position, email, password: password ? '[HIDDEN]' : 'MISSING', gender, dob, phone_number, start_work, end_work });
      
      // Basic validation for required fields
      if (!name || !email || !password) {
        const missingFields = [];
        if (!name) missingFields.push('ชื่อ');
        if (!email) missingFields.push('อีเมล');
        if (!password) missingFields.push('รหัสผ่าน');
        return sendValidationError(res, `กรุณากรอกข้อมูลที่จำเป็น: ${missingFields.join(', ')}`);
      }
      
      const userRepo = AppDataSource.getRepository('User');
      const processRepo = AppDataSource.getRepository('User');
      const departmentRepo = AppDataSource.getRepository('Department');
      const positionRepo = AppDataSource.getRepository('Position');

      // ตรวจสอบชื่อซ้ำ
      console.log('Checking for duplicate name:', name);
      const nameExist = await userRepo.findOneBy({ name });
      if (nameExist) {
        console.log('Duplicate name found:', nameExist);
        return sendValidationError(res, `ชื่อ "${name}" ถูกใช้ไปแล้ว กรุณาใช้ชื่ออื่น`);
      }

      // ตรวจสอบ email ซ้ำ
      const exist = await processRepo.findOneBy({ Email: email });
      if (exist) {
        return sendValidationError(res, `อีเมล "${email}" ถูกใช้ไปแล้ว กรุณาใช้อีเมลอื่น`);
      }

      // แปลง department id เป็น entity
      let departmentId = null;
      if (department && department.trim() !== '') {
        try {
          const deptEntity = await departmentController.findOne(AppDataSource, department);
          if (!deptEntity) {
            console.log('Department not found for ID:', department);
            return sendValidationError(res, 'แผนกที่เลือกไม่ถูกต้อง กรุณาเลือกแผนกใหม่');
          } else {
            departmentId = deptEntity.id;
            console.log('Department found:', deptEntity.department_name_en || deptEntity.department_name_th);
          }
        } catch (deptError) {
          console.error('Department lookup error:', deptError);
          return sendValidationError(res, 'ไม่สามารถตรวจสอบแผนกได้ กรุณาลองใหม่');
        }
      }

      // แปลง position id เป็น entity
      let positionId = null;
      if (position && position.trim() !== '') {
        try {
          const posEntity = await positionController.findOne(AppDataSource, position);
          if (!posEntity) {
            console.log('Position not found for ID:', position);
            return sendValidationError(res, 'ตำแหน่งที่เลือกไม่ถูกต้อง กรุณาเลือกตำแหน่งใหม่');
          } else {
            positionId = posEntity.id;
            console.log('Position found:', posEntity.position_name_en || posEntity.position_name_th);
          }
        } catch (posError) {
          console.error('Position lookup error:', posError);
          return sendValidationError(res, 'ไม่สามารถตรวจสอบตำแหน่งได้ กรุณาลองใหม่');
        }
      }

      // hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // สร้าง JWT Token
      const userId = uuidv4();
      const token = jwt.sign(
        { userId: userId, email: email },
        config.server.jwtSecret,
        { expiresIn: config.server.jwtExpiresIn }
      );

      // สร้าง user ใน unified users table (single row with all data)
      const userData = {
        id: userId,
        name,
        Email: email,
        Password: hashedPassword,
        Token: token,
        Role: 'user', // Always create as 'user' role for public registration
        department: departmentId,
        position: positionId,
        gender: gender || null,
        dob: dob || null,
        phone_number: phone_number || null,
        start_work: start_work || null,
        end_work: (end_work && end_work !== 'undefined' && end_work.trim() !== '') ? end_work : null,
        avatar_url: null
      };
      
      console.log('Creating user with data:', {
        ...userData,
        Password: '[HIDDEN]',
        Token: '[HIDDEN]'
      });
      
      const user = processRepo.create(userData);
      console.log('User entity created, saving to database...');
      await processRepo.save(user);
      console.log('User saved successfully:', user.id);

      sendSuccess(res, { ...user, token, repid: user.id }, 'Register successful', 201);
    } catch (err) {
      console.error('Registration error:', err);
      
      // Handle unique constraint errors
      if (err.code === 'ER_DUP_ENTRY' && err.message.includes('Email')) {
        return sendValidationError(res, 'Email นี้ถูกใช้ไปแล้ว');
      }
      if (err.code === 'ER_DUP_ENTRY' && err.message.includes('name')) {
        return sendValidationError(res, 'ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว');
      }
      
      // Handle validation errors
      if (err.name === 'ValidationError') {
        return sendValidationError(res, err.message);
      }
      
      // Handle database constraint errors
      if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return sendValidationError(res, 'แผนกหรือตำแหน่งที่เลือกไม่ถูกต้อง กรุณาเลือกใหม่');
      }
      
      // Handle unique constraint errors for name
      if (err.code === 'ER_DUP_ENTRY' && err.message.includes('name')) {
        return sendValidationError(res, `ชื่อ "${name}" ถูกใช้ไปแล้ว กรุณาใช้ชื่ออื่น`);
      }
      
      // Handle unique constraint errors for email
      if (err.code === 'ER_DUP_ENTRY' && err.message.includes('Email')) {
        return sendValidationError(res, `อีเมล "${email}" ถูกใช้ไปแล้ว กรุณาใช้อีเมลอื่น`);
      }
      
      sendError(res, err.message, 500);
    }
  });

  // หมายเหตุ: เส้นทาง /departments และ /positions ถูกย้ายให้ใช้ที่ DepartmentController/PositionController เท่านั้น
  // เพื่อลดความซ้ำซ้อนและให้โครงสร้างข้อมูลสอดคล้องกันทั้งระบบ

  return router;
};
// เหตุผล: ต้องสร้าง user ก่อนเพื่อให้ได้ user.id แล้วจึงนำ user.id ไปใส่ Repid ใน process_check และบันทึก Token พร้อมกัน เพื่อให้ข้อมูลสัมพันธ์กันและปลอดภัย