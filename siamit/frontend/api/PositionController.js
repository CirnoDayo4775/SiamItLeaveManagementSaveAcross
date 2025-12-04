const express = require('express');
const router = express.Router();
const { BaseController, sendSuccess, sendError, sendNotFound } = require('../utils');

/**
 * @swagger
 * /api/positions:
 *   get:
 *     summary: Get all positions
 *     tags:
 *       - Positions
 *     responses:
 *       200:
 *         description: A list of positions
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
  // Create base controller instance for Position
  const positionController = new BaseController('Position');

  router.get('/positions', async (req, res) => {
    try {
      const positions = await positionController.findAll(AppDataSource);
      sendSuccess(res, positions, 'Positions fetched successfully');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  /**
   * @swagger
   * /api/positions:
   *   post:
   *     summary: Create a new position
   *     tags:
   *       - Positions
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               position_name:
   *                 type: string
   *     responses:
   *       201:
   *         description: Position created
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
  router.post('/positions', async (req, res) => {
    try {
      const saved = await positionController.create(AppDataSource, req.body);
      sendSuccess(res, saved, 'Position created successfully', 201);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  /**
   * @swagger
   * /api/positions/{id}:
   *   delete:
   *     summary: Delete a position by ID
   *     tags:
   *       - Positions
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The position ID
   *     responses:
   *       200:
   *         description: Position deleted
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
  router.delete('/positions/:id', async (req, res) => {
    try {
      await positionController.delete(AppDataSource, req.params.id);
      sendSuccess(res, null, 'Position deleted successfully');
    } catch (err) {
      if (err.message === 'Record not found') {
        return sendNotFound(res, 'Position not found');
      }
      sendError(res, err.message, 500);
    }
  });

  /**
   * @swagger
   * /api/positions/{id}:
   *   put:
   *     summary: Update a position by ID
   *     tags:
   *       - Positions
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
   *     responses:
   *       200:
   *         description: Position updated
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
  router.put('/positions/:id', async (req, res) => {
    try {
      const updated = await positionController.update(AppDataSource, req.params.id, req.body);
      sendSuccess(res, updated, 'Position updated successfully');
    } catch (err) {
      if (err.message === 'Record not found') {
        return sendNotFound(res, 'Position not found');
      }
      sendError(res, err.message, 500);
    }
  });

  return router;
};
