const express = require('express');
const router = express.Router();
const { BaseController, sendSuccess, sendError, sendNotFound } = require('../utils');

module.exports = (AppDataSource) => {
  // Create base controller instance for Position
  const positionController = new BaseController('Position');

  // --- Helper: Async Error Handler ---
  const safeHandler = (handler) => async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      if (err.message === 'Record not found') {
        return sendNotFound(res, 'Position not found');
      }
      sendError(res, err.message, 500);
    }
  };

  // --- Routes ---


  router.get('/positions', safeHandler(async (req, res) => {
    const positions = await positionController.findAll(AppDataSource);
    sendSuccess(res, positions, 'Positions fetched successfully');
  }));


  router.post('/positions', safeHandler(async (req, res) => {
    const saved = await positionController.create(AppDataSource, req.body);
    sendSuccess(res, saved, 'Position created successfully', 201);
  }));


  router.put('/positions/:id', safeHandler(async (req, res) => {
    const updated = await positionController.update(AppDataSource, req.params.id, req.body);
    sendSuccess(res, updated, 'Position updated successfully');
  }));


  router.delete('/positions/:id', safeHandler(async (req, res) => {
    await positionController.delete(AppDataSource, req.params.id);
    sendSuccess(res, null, 'Position deleted successfully');
  }));

  return router;
};