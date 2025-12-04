/**
 * Example Controller
 * Demonstrates how to use BaseController and utility functions to eliminate duplication
 */

const express = require('express');
const router = express.Router();
const { BaseController, sendSuccess, sendError, sendNotFound } = require('../utils');

/**
 * @swagger
 * /api/example:
 *   get:
 *     summary: Get all examples
 *     tags: [Example]
 *     responses:
 *       200:
 *         description: List of examples
 */
module.exports = (AppDataSource) => {
  // Create base controller instance
  const exampleController = new BaseController('Example');

  // Method 1: Use individual handler methods
  router.get('/example', async (req, res) => {
    try {
      const examples = await exampleController.findAll(AppDataSource);
      sendSuccess(res, examples, 'Examples fetched successfully');
    } catch (error) {
      sendError(res, error.message, 500);
    }
  });

  router.get('/example/:id', async (req, res) => {
    try {
      const example = await exampleController.findOne(AppDataSource, req.params.id);
      if (!example) {
        return sendNotFound(res, 'Example not found');
      }
      sendSuccess(res, example, 'Example fetched successfully');
    } catch (error) {
      sendError(res, error.message, 500);
    }
  });

  router.post('/example', async (req, res) => {
    try {
      const example = await exampleController.create(AppDataSource, req.body);
      sendSuccess(res, example, 'Example created successfully', 201);
    } catch (error) {
      sendError(res, error.message, 500);
    }
  });

  router.put('/example/:id', async (req, res) => {
    try {
      const example = await exampleController.update(AppDataSource, req.params.id, req.body);
      sendSuccess(res, example, 'Example updated successfully');
    } catch (error) {
      if (error.message === 'Record not found') {
        return sendNotFound(res, 'Example not found');
      }
      sendError(res, error.message, 500);
    }
  });

  router.delete('/example/:id', async (req, res) => {
    try {
      await exampleController.delete(AppDataSource, req.params.id);
      sendSuccess(res, null, 'Example deleted successfully');
    } catch (error) {
      if (error.message === 'Record not found') {
        return sendNotFound(res, 'Example not found');
      }
      sendError(res, error.message, 500);
    }
  });

  // Method 2: Use the createCRUDRoutes method for automatic CRUD routes
  // Uncomment the following lines to use automatic CRUD routes
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