const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { BaseController, sendSuccess, sendError, sendNotFound, sendValidationError } = require('../utils');

module.exports = (AppDataSource) => {
  // Create base controller instance
  const customHolidayController = new BaseController('CustomHoliday');
  const userRepo = AppDataSource.getRepository('User');
  const customHolidayRepo = AppDataSource.getRepository('CustomHoliday');

  // --- Helper Functions ---

  /**
   * Helper: Attach user names to holiday objects efficiently (Avoids N+1 Query Problem)
   */
  const enrichWithUserNames = async (holidays) => {
    // Handle single object or empty array
    const isArray = Array.isArray(holidays);
    const items = isArray ? holidays : [holidays];
    if (!items.length) return isArray ? [] : null;

    // 1. Extract unique User IDs
    const userIds = [...new Set(items.map(h => h.createdBy).filter(Boolean))];

    // 2. Batch fetch users
    let userMap = {};
    if (userIds.length > 0) {
      const users = await userRepo.createQueryBuilder("user")
        .select(["user.id", "user.name"]) // Select only needed fields
        .where("user.id IN (:...ids)", { ids: userIds })
        .getMany();
      
      userMap = users.reduce((acc, user) => {
        acc[user.id] = user.name;
        return acc;
      }, {});
    }

    // 3. Map names back to items
    const enriched = items.map(holiday => ({
      ...holiday,
      createdByName: userMap[holiday.createdBy] || 'Unknown User'
    }));

    return isArray ? enriched : enriched[0];
  };

  /**
   * Helper: Emit socket event safely
   */
  const emitSocketEvent = (eventName, holidayData) => {
    if (global.io) {
      global.io.emit(eventName, {
        id: holidayData.id,
        title: holidayData.title,
        description: holidayData.description,
        date: holidayData.date,
        createdAt: holidayData.createdAt,
        createdBy: holidayData.createdBy,
        type: 'company'
      });
    }
  };

  // --- Routes ---

  // GET all custom holidays
  router.get('/custom-holidays', async (req, res) => {
    try {
      const holidays = await customHolidayController.findAll(AppDataSource, {
        order: { date: 'ASC' }
      });
      
      const data = await enrichWithUserNames(holidays);
      sendSuccess(res, data, 'Custom holidays fetched successfully');
    } catch (error) {
      console.error('Error fetching custom holidays:', error);
      sendError(res, 'Failed to fetch custom holidays', 500);
    }
  });

  // GET custom holiday by ID
  router.get('/custom-holidays/:id', async (req, res) => {
    try {
      const holiday = await customHolidayController.findOne(AppDataSource, req.params.id);
      
      if (!holiday) {
        return sendNotFound(res, 'Custom holiday not found');
      }
      
      const data = await enrichWithUserNames(holiday);
      sendSuccess(res, data, 'Custom holiday fetched successfully');
    } catch (error) {
      console.error('Error fetching custom holiday:', error);
      sendError(res, 'Failed to fetch custom holiday', 500);
    }
  });

  // Create new custom holiday
  router.post('/custom-holidays', authMiddleware, async (req, res) => {
    try {
      const { title, description, date } = req.body;
      const createdBy = req.user?.userId || null;
      
      const savedHoliday = await customHolidayController.create(AppDataSource, {
        title,
        description,
        date,
        createdBy
      });
      
      emitSocketEvent('newCompanyEvent', savedHoliday);
      
      sendSuccess(res, savedHoliday, 'Custom holiday created successfully', 201);
    } catch (err) {
      console.error('Error creating custom holiday:', err);
      sendError(res, err.message, 500);
    }
  });

  // Update custom holiday
  router.put('/custom-holidays/:id', authMiddleware, async (req, res) => {
    try {
      const { title, description, date } = req.body;
      
      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (date !== undefined) updateData.date = date;
      
      const updatedHoliday = await customHolidayController.update(AppDataSource, req.params.id, updateData);
      
      emitSocketEvent('companyEventUpdated', updatedHoliday);
      
      sendSuccess(res, updatedHoliday, 'Custom holiday updated successfully');
    } catch (err) {
      if (err.message === 'Record not found') {
        return sendNotFound(res, 'Custom holiday not found');
      }
      console.error('Error updating custom holiday:', err);
      sendError(res, err.message, 500);
    }
  });

  // Delete custom holiday
  router.delete('/custom-holidays/:id', authMiddleware, async (req, res) => {
    try {
      // Find first to ensure existence and get data for socket
      const holiday = await customHolidayController.findOne(AppDataSource, req.params.id);
      
      if (!holiday) {
        return sendNotFound(res, 'Custom holiday not found');
      }
      
      await customHolidayController.delete(AppDataSource, req.params.id);
      
      emitSocketEvent('companyEventDeleted', holiday);
      
      sendSuccess(res, null, 'Custom holiday deleted successfully');
    } catch (err) {
      console.error('Error deleting custom holiday:', err);
      sendError(res, err.message, 500);
    }
  });

  // GET custom holidays by date range
  router.get('/custom-holidays/range', async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return sendValidationError(res, 'Start date and end date are required');
      }
      
      const holidays = await customHolidayRepo
        .createQueryBuilder('holiday')
        .where('holiday.date >= :startDate', { startDate })
        .andWhere('holiday.date <= :endDate', { endDate })
        .orderBy('holiday.date', 'ASC')
        .getMany();
      
      const data = await enrichWithUserNames(holidays);
      sendSuccess(res, data, 'Custom holidays fetched successfully');
    } catch (error) {
      console.error('Error fetching custom holidays by range:', error);
      sendError(res, 'Failed to fetch custom holidays by range', 500);
    }
  });

  // GET custom holidays by year
  router.get('/custom-holidays/year/:year', async (req, res) => {
    try {
      const { year } = req.params;
      
      if (!year || isNaN(year)) {
        return sendValidationError(res, 'Valid year is required');
      }
      
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      
      const holidays = await customHolidayRepo
        .createQueryBuilder('holiday')
        .where('holiday.date >= :startDate', { startDate })
        .andWhere('holiday.date <= :endDate', { endDate })
        .orderBy('holiday.date', 'ASC')
        .getMany();
      
      const data = await enrichWithUserNames(holidays);
      sendSuccess(res, data, 'Custom holidays fetched successfully');
    } catch (error) {
      console.error('Error fetching custom holidays by year:', error);
      sendError(res, 'Failed to fetch custom holidays by year', 500);
    }
  });

  // GET custom holidays by year and month
  router.get('/custom-holidays/year/:year/month/:month', async (req, res) => {
    try {
      const { year, month } = req.params;
      
      if (!year || isNaN(year) || !month || isNaN(month)) {
        return sendValidationError(res, 'Valid year and month are required');
      }

      const monthInt = parseInt(month, 10);
      
      if (monthInt < 1 || monthInt > 12) {
        return sendValidationError(res, 'Month must be between 1 and 12');
      }
      
      // Calculate strict last day of the month to avoid "Feb 31" errors
      const lastDay = new Date(year, monthInt, 0).getDate();
      const startDate = `${year}-${monthInt.toString().padStart(2, '0')}-01`;
      const endDate = `${year}-${monthInt.toString().padStart(2, '0')}-${lastDay}`;
      
      const holidays = await customHolidayRepo
        .createQueryBuilder('holiday')
        .where('holiday.date >= :startDate', { startDate })
        .andWhere('holiday.date <= :endDate', { endDate })
        .orderBy('holiday.date', 'ASC')
        .getMany();
      
      const data = await enrichWithUserNames(holidays);
      sendSuccess(res, data, 'Custom holidays fetched successfully');
    } catch (error) {
      console.error('Error fetching custom holidays by year and month:', error);
      sendError(res, 'Failed to fetch custom holidays by year and month', 500);
    }
  });

  return router;
};