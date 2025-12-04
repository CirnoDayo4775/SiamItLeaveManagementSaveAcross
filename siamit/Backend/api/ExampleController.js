const express = require('express');
const router = express.Router();
const { BaseController, sendSuccess, sendError, sendNotFound } = require('../utils');


module.exports = (AppDataSource) => {
  // Create base controller instance
  const exampleController = new BaseController('Example');

  /**
   * Helper: Higher-order function to handle async errors and standard responses
   * Eliminates repetitive try-catch blocks
   */
  const safeHandler = (handler) => async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err.message === 'Record not found') {
        return sendNotFound(res, 'Example not found');
      }
      sendError(res, err.message, 500);
    }
  };

  // --- Routes ---


  router.get('/example', safeHandler(async (req, res) => {
    const examples = await exampleController.findAll(AppDataSource);
    sendSuccess(res, examples, 'Examples fetched successfully');
  }));


  router.get('/example/:id', safeHandler(async (req, res) => {
    const example = await exampleController.findOne(AppDataSource, req.params.id);
    if (!example) return sendNotFound(res, 'Example not found');
    sendSuccess(res, example, 'Example fetched successfully');
  }));


  router.post('/example', safeHandler(async (req, res) => {
    const example = await exampleController.create(AppDataSource, req.body);
    sendSuccess(res, example, 'Example created successfully', 201);
  }));

  router.put('/example/:id', safeHandler(async (req, res) => {
    const example = await exampleController.update(AppDataSource, req.params.id, req.body);
    sendSuccess(res, example, 'Example updated successfully');
  }));


  router.delete('/example/:id', safeHandler(async (req, res) => {
    await exampleController.delete(AppDataSource, req.params.id);
    sendSuccess(res, null, 'Example deleted successfully');
  }));

  // Method 2: Use the createCRUDRoutes method for automatic CRUD routes
  /*
  exampleController.createCRUDRoutes(router, AppDataSource, {
    basePath: '/example-auto',
    getMessage: 'Examples fetched successfully',
    getByIdMessage: 'Example fetched successfully',
    createMessage: 'Example created successfully',
    updateMessage: 'Example updated successfully',
    deleteMessage: 'Example deleted successfully'
  });
  */

  return router;
};