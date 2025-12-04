/**
 * Base Controller Class
 * Provides common CRUD operations and error handling for all controllers
 */

const { sendSuccess, sendError, sendNotFound, sendValidationError } = require('./responseUtils');

class BaseController {
  constructor(repositoryName) {
    this.repositoryName = repositoryName;
  }

  /**
   * Get repository instance
   * @param {Object} AppDataSource - Database connection
   * @returns {Object} Repository instance
   */
  getRepository(AppDataSource) {
    return AppDataSource.getRepository(this.repositoryName);
  }

  /**
   * Find all records
   * @param {Object} AppDataSource - Database connection
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of records
   */
  async findAll(AppDataSource, options = {}) {
    const repo = this.getRepository(AppDataSource);
    
    // If this is LeaveType, automatically filter out inactive records
    if (this.repositoryName === 'LeaveType') {
      try {
        // Simple approach: try to use soft delete filtering, fallback if it fails
        const defaultOptions = {
          where: { is_active: true, deleted_at: null },
          ...options
        };
        return await repo.find(defaultOptions);
      } catch (error) {
        // Fallback to original logic if soft delete columns don't exist
        console.warn('Soft delete columns not found, using original findAll logic:', error.message);
        return await repo.find(options);
      }
    }
    
    // For other entities, use original logic
    return await repo.find(options);
  }

  /**
   * Find all records including soft-deleted (for LeaveType admin operations)
   * @param {Object} AppDataSource - Database connection
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of all records
   */
  async findAllIncludingDeleted(AppDataSource, options = {}) {
    const repo = this.getRepository(AppDataSource);
    return await repo.find(options);
  }

  /**
   * Find one record by ID
   * @param {Object} AppDataSource - Database connection
   * @param {string|number} id - Record ID
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} Record or null
   */
  async findOne(AppDataSource, id, options = {}) {
    const repo = this.getRepository(AppDataSource);
    return await repo.findOneBy({ id, ...options });
  }

  /**
   * Find one record by criteria
   * @param {Object} AppDataSource - Database connection
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} Record or null
   */
  async findOneBy(AppDataSource, criteria, options = {}) {
    const repo = this.getRepository(AppDataSource);
    return await repo.findOneBy({ ...criteria, ...options });
  }

  /**
   * Create a new record
   * @param {Object} AppDataSource - Database connection
   * @param {Object} data - Record data
   * @returns {Promise<Object>} Created record
   */
  async create(AppDataSource, data) {
    const repo = this.getRepository(AppDataSource);
    const entity = repo.create(data);
    return await repo.save(entity);
  }

  /**
   * Update a record
   * @param {Object} AppDataSource - Database connection
   * @param {string|number} id - Record ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated record
   */
  async update(AppDataSource, id, data) {
    const repo = this.getRepository(AppDataSource);
    const entity = await repo.findOneBy({ id });
    if (!entity) {
      throw new Error('Record not found');
    }
    Object.assign(entity, data);
    return await repo.save(entity);
  }

  /**
   * Delete a record
   * @param {Object} AppDataSource - Database connection
   * @param {string|number} id - Record ID
   * @returns {Promise<Object>} Deletion result
   */
  async delete(AppDataSource, id) {
    const repo = this.getRepository(AppDataSource);
    const entity = await repo.findOneBy({ id });
    if (!entity) {
      throw new Error('Record not found');
    }
    return await repo.delete({ id });
  }

  /**
   * Soft delete a record
   * @param {Object} AppDataSource - Database connection
   * @param {string|number} id - Record ID
   * @returns {Promise<Object>} Soft deletion result
   */
  async softDelete(AppDataSource, id) {
    const repo = this.getRepository(AppDataSource);
    const entity = await repo.findOneBy({ id });
    if (!entity) {
      throw new Error('Record not found');
    }
    
    try {
      // Check if soft delete columns exist
      if (entity.hasOwnProperty('deleted_at')) {
        entity.deleted_at = new Date();
        // Also set is_active to false for soft delete
        if (entity.hasOwnProperty('is_active')) {
          entity.is_active = false;
        }
        return await repo.save(entity);
      } else {
        // Fallback to hard delete if soft delete columns don't exist
        console.warn('Soft delete columns not found, falling back to hard delete');
        return await repo.delete({ id });
      }
    } catch (error) {
      console.error('Soft delete failed:', error);
      // If soft delete fails, fall back to hard delete
      console.warn('Falling back to hard delete');
      return await repo.delete({ id });
    }
  }

  /**
   * Restore a soft-deleted record
   * @param {Object} AppDataSource - Database connection
   * @param {string|number} id - Record ID
   * @returns {Promise<Object>} Restoration result
   */
  async restore(AppDataSource, id) {
    const repo = this.getRepository(AppDataSource);
    const entity = await repo.findOneBy({ id });
    if (!entity) {
      throw new Error('Record not found');
    }
    
    try {
      // Check if soft delete columns exist
      if (entity.hasOwnProperty('deleted_at')) {
        entity.deleted_at = null;
        // Also set is_active back to true when restoring
        if (entity.hasOwnProperty('is_active')) {
          entity.is_active = true;
        }
        return await repo.save(entity);
      } else {
        throw new Error('Soft delete columns not available for restoration');
      }
    } catch (error) {
      console.error('Restore failed:', error);
      throw error;
    }
  }

  /**
   * Standard GET all handler
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Object} AppDataSource - Database connection
   * @param {string} successMessage - Success message
   */
  async handleGetAll(req, res, AppDataSource, successMessage = 'Records fetched successfully') {
    try {
      const records = await this.findAll(AppDataSource);
      sendSuccess(res, records, successMessage);
    } catch (error) {
      sendError(res, error.message, 500);
    }
  }

  /**
   * Standard GET by ID handler
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Object} AppDataSource - Database connection
   * @param {string} successMessage - Success message
   */
  async handleGetById(req, res, AppDataSource, successMessage = 'Record fetched successfully') {
    try {
      const record = await this.findOne(AppDataSource, req.params.id);
      if (!record) {
        return sendNotFound(res, 'Record not found');
      }
      sendSuccess(res, record, successMessage);
    } catch (error) {
      sendError(res, error.message, 500);
    }
  }

  /**
   * Standard POST handler
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Object} AppDataSource - Database connection
   * @param {string} successMessage - Success message
   */
  async handleCreate(req, res, AppDataSource, successMessage = 'Record created successfully') {
    try {
      const record = await this.create(AppDataSource, req.body);
      sendSuccess(res, record, successMessage, 201);
    } catch (error) {
      sendError(res, error.message, 500);
    }
  }

  /**
   * Standard PUT handler
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Object} AppDataSource - Database connection
   * @param {string} successMessage - Success message
   */
  async handleUpdate(req, res, AppDataSource, successMessage = 'Record updated successfully') {
    try {
      const record = await this.update(AppDataSource, req.params.id, req.body);
      sendSuccess(res, record, successMessage);
    } catch (error) {
      if (error.message === 'Record not found') {
        return sendNotFound(res, 'Record not found');
      }
      sendError(res, error.message, 500);
    }
  }

  /**
   * Standard DELETE handler
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Object} AppDataSource - Database connection
   * @param {string} successMessage - Success message
   */
  async handleDelete(req, res, AppDataSource, successMessage = 'Record deleted successfully') {
    try {
      await this.delete(AppDataSource, req.params.id);
      sendSuccess(res, null, successMessage);
    } catch (error) {
      if (error.message === 'Record not found') {
        return sendNotFound(res, 'Record not found');
      }
      sendError(res, error.message, 500);
    }
  }

  /**
   * Create standard CRUD routes
   * @param {Object} router - Express router
   * @param {Object} AppDataSource - Database connection
   * @param {Object} options - Route options
   */
  createCRUDRoutes(router, AppDataSource, options = {}) {
    const {
      basePath = '',
      getMessage = 'Records fetched successfully',
      getByIdMessage = 'Record fetched successfully',
      createMessage = 'Record created successfully',
      updateMessage = 'Record updated successfully',
      deleteMessage = 'Record deleted successfully',
      middleware = []
    } = options;

    // GET all
    router.get(`${basePath}`, middleware, (req, res) => 
      this.handleGetAll(req, res, AppDataSource, getMessage)
    );

    // GET by ID
    router.get(`${basePath}/:id`, middleware, (req, res) => 
      this.handleGetById(req, res, AppDataSource, getByIdMessage)
    );

    // POST create
    router.post(`${basePath}`, middleware, (req, res) => 
      this.handleCreate(req, res, AppDataSource, createMessage)
    );

    // PUT update
    router.put(`${basePath}/:id`, middleware, (req, res) => 
      this.handleUpdate(req, res, AppDataSource, updateMessage)
    );

    // DELETE
    router.delete(`${basePath}/:id`, middleware, (req, res) => 
      this.handleDelete(req, res, AppDataSource, deleteMessage)
    );
  }
}

module.exports = BaseController; 