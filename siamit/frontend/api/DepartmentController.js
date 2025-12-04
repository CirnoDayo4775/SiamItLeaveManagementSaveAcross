const express = require('express');
const router = express.Router();
const { BaseController, sendSuccess, sendError, sendNotFound, sendValidationError } = require('../utils');

/**
 * @swagger
 * /api/departments:
 *   get:
 *     summary: Get all departments
 *     tags:
 *       - Departments
 *     responses:
 *       200:
 *         description: A list of departments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 message:
 *                   type: string
 */

module.exports = (AppDataSource) => {
  // Create base controller instance for Department
  const departmentController = new BaseController('Department');

  router.get('/departments', async (req, res) => {
    try {
      const departments = await departmentController.findAll(AppDataSource);
      sendSuccess(res, departments, 'Departments fetched successfully');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  /**
   * @swagger
   * /api/departments:
   *   post:
   *     summary: Create a new department
   *     tags:
   *       - Departments
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               department_name_en:
   *                 type: string
   *               department_name_th:
   *                 type: string
   *     responses:
   *       201:
   *         description: Department created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                 data:
   *                   type: object
   *                 message:
   *                   type: string
   */
  router.post('/departments', async (req, res) => {
    try {
      const { department_name_en, department_name_th } = req.body;
      if (!department_name_en || !department_name_th) {
        return sendValidationError(res, 'Both department_name_en and department_name_th are required');
      }
      const saved = await departmentController.create(AppDataSource, { department_name_en, department_name_th });
      sendSuccess(res, saved, 'Department created successfully', 201);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  /**
   * @swagger
   * /api/departments/{id}:
   *   delete:
   *     summary: Delete a department by ID
   *     tags:
   *       - Departments
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The department ID
   *     responses:
   *       200:
   *         description: Department deleted
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                 data:
   *                   type: object
   *                 message:
   *                   type: string
   */
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

  /**
   * @swagger
   * /api/departments/{id}:
   *   put:
   *     summary: Update a department by ID
   *     tags:
   *       - Departments
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The department ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               department_name_en:
   *                 type: string
   *               department_name_th:
   *                 type: string
   *     responses:
   *       200:
   *         description: Department updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                 data:
   *                   type: object
   *                 message:
   *                   type: string
   */
  router.put('/departments/:id', async (req, res) => {
    try {
      const { department_name_en, department_name_th } = req.body;
      if (!department_name_en || !department_name_th) {
        return sendValidationError(res, 'Both department_name_en and department_name_th are required');
      }
      const updated = await departmentController.update(AppDataSource, req.params.id, { department_name_en, department_name_th });
      sendSuccess(res, updated, 'Department updated successfully');
    } catch (err) {
      if (err.message === 'Record not found') {
        return sendNotFound(res, 'Department not found');
      }
      sendError(res, err.message, 500);
    }
  });

  return router;
};
