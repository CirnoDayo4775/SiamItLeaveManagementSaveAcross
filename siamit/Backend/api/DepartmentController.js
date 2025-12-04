const express = require('express');
const router = express.Router();
const { BaseController, sendSuccess, sendError, sendNotFound, sendValidationError } = require('../utils');

module.exports = (AppDataSource) => {
  // Create base controller instance for Department
  const departmentController = new BaseController('Department');

  // --- Helper Functions ---

  /**
   * Helper to validate department payload
   */
  const validateDepartmentBody = (body) => {
    const { department_name_en, department_name_th } = body;
    if (!department_name_en || !department_name_th) {
      return 'Both department_name_en and department_name_th are required';
    }
    return null;
  };

  // --- Routes ---

 
  router.get('/departments', async (req, res) => {
    try {
      const departments = await departmentController.findAll(AppDataSource);
      sendSuccess(res, departments, 'Departments fetched successfully');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });


  router.post('/departments', async (req, res) => {
    try {
      const error = validateDepartmentBody(req.body);
      if (error) return sendValidationError(res, error);

      const { department_name_en, department_name_th } = req.body;
      const saved = await departmentController.create(AppDataSource, { 
        department_name_en, 
        department_name_th 
      });
      
      sendSuccess(res, saved, 'Department created successfully', 201);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });


  router.put('/departments/:id', async (req, res) => {
    try {
      const error = validateDepartmentBody(req.body);
      if (error) return sendValidationError(res, error);

      const { department_name_en, department_name_th } = req.body;
      const updated = await departmentController.update(AppDataSource, req.params.id, { 
        department_name_en, 
        department_name_th 
      });

      sendSuccess(res, updated, 'Department updated successfully');
    } catch (err) {
      if (err.message === 'Record not found') {
        return sendNotFound(res, 'Department not found');
      }
      sendError(res, err.message, 500);
    }
  });


  router.delete('/departments/:id', async (req, res) => {
    try {
      await departmentController.delete(AppDataSource, req.params.id);
      sendSuccess(res, null, 'Department deleted successfully');
    } catch (err) {
      if (err.message === 'Record not found') {
        return sendNotFound(res, 'Department not found');
      }
      sendError(res, err.message, 500);
    }
  });

  return router;
};