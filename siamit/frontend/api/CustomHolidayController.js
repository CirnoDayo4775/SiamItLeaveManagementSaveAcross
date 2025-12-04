const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { BaseController, sendSuccess, sendError, sendNotFound, sendValidationError } = require('../utils');

module.exports = (AppDataSource) => {
  // Create base controller instance for CustomHoliday
  const customHolidayController = new BaseController('CustomHoliday');

  // Helper function to get user name by ID
  const getUserNameById = async (userId) => {
    if (!userId) return 'Unknown User';
    
    try {
      // Find the user by ID in unified users table
      const userRepo = AppDataSource.getRepository('User');
      const user = await userRepo.findOne({
        where: { id: userId }
      });
      
      // If user found, get their name
      if (user) {
        if (user.name) {
          return user.name;
        }
      }
      
      return 'Unknown User';
    } catch (error) {
      console.error('Error getting user name by ID:', error);
      return 'Unknown User';
    }
  };

  // GET all custom holidays
  router.get('/custom-holidays', async (req, res) => {
      try {
          const holidays = await customHolidayController.findAll(AppDataSource, {
              order: {
                  date: 'ASC'
              }
          });
          
          // Get user names for each holiday
          const holidaysWithUserNames = await Promise.all(
              holidays.map(async (holiday) => {
                  const createdByName = await getUserNameById(holiday.createdBy);
                  return {
                      ...holiday,
                      createdByName
                  };
              })
          );
          
          sendSuccess(res, holidaysWithUserNames, 'Custom holidays fetched successfully');
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
          
          // Get user name for the holiday
          const createdByName = await getUserNameById(holiday.createdBy);
          
          const holidayWithUserName = {
              ...holiday,
              createdByName
          };
          
          sendSuccess(res, holidayWithUserName, 'Custom holiday fetched successfully');
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
      
      // Emit Socket.io event for real-time notification
      if (global.io) {
        global.io.emit('newCompanyEvent', {
          id: savedHoliday.id,
          title: savedHoliday.title,
          description: savedHoliday.description,
          date: savedHoliday.date,
          createdAt: savedHoliday.createdAt,
          createdBy: savedHoliday.createdBy,
          type: 'company'
        });
      }
      
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
      
      // Emit Socket.io event for real-time notification
      if (global.io) {
        global.io.emit('companyEventUpdated', {
          id: updatedHoliday.id,
          title: updatedHoliday.title,
          description: updatedHoliday.description,
          date: updatedHoliday.date,
          createdAt: updatedHoliday.createdAt,
          createdBy: updatedHoliday.createdBy,
          type: 'company'
        });
      }
      
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
      const holiday = await customHolidayController.findOne(AppDataSource, req.params.id);
      
      if (!holiday) {
        return sendNotFound(res, 'Custom holiday not found');
      }
      
      await customHolidayController.delete(AppDataSource, req.params.id);
      
      // Emit Socket.io event for real-time notification
      if (global.io) {
        global.io.emit('companyEventDeleted', {
          id: holiday.id,
          title: holiday.title,
          description: holiday.description,
          date: holiday.date,
          createdAt: holiday.createdAt,
          createdBy: holiday.createdBy,
          type: 'company'
        });
      }
      
      sendSuccess(res, null, 'Custom holiday deleted successfully');
    } catch (err) {
      if (err.message === 'Record not found') {
        return sendNotFound(res, 'Custom holiday not found');
      }
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
          
          const customHolidayRepository = AppDataSource.getRepository('CustomHoliday');
        const holidays = await customHolidayRepository
            .createQueryBuilder('holiday')
            .where('holiday.date >= :startDate', { startDate })
            .andWhere('holiday.date <= :endDate', { endDate })
            .orderBy('holiday.date', 'ASC')
            .getMany();
        
        // Get user names for each holiday
        const holidaysWithUserNames = await Promise.all(
            holidays.map(async (holiday) => {
                const createdByName = await getUserNameById(holiday.createdBy);
                return {
                    ...holiday,
                    createdByName
                };
            })
        );
        
        sendSuccess(res, holidaysWithUserNames, 'Custom holidays fetched successfully');
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
          
          const customHolidayRepository = AppDataSource.getRepository('CustomHoliday');
        const holidays = await customHolidayRepository
            .createQueryBuilder('holiday')
            .where('holiday.date >= :startDate', { startDate })
            .andWhere('holiday.date <= :endDate', { endDate })
            .orderBy('holiday.date', 'ASC')
            .getMany();
        
        // Get user names for each holiday
        const holidaysWithUserNames = await Promise.all(
            holidays.map(async (holiday) => {
                const createdByName = await getUserNameById(holiday.createdBy);
                return {
                    ...holiday,
                    createdByName
                };
            })
        );
        
        sendSuccess(res, holidaysWithUserNames, 'Custom holidays fetched successfully');
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
          
          // Validate month is between 1-12
          if (month < 1 || month > 12) {
              return sendValidationError(res, 'Month must be between 1 and 12');
          }
          
          const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
          const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;
          
          const customHolidayRepository = AppDataSource.getRepository('CustomHoliday');
        const holidays = await customHolidayRepository
            .createQueryBuilder('holiday')
            .where('holiday.date >= :startDate', { startDate })
            .andWhere('holiday.date <= :endDate', { endDate })
            .orderBy('holiday.date', 'ASC')
            .getMany();
        
        // Get user names for each holiday
        const holidaysWithUserNames = await Promise.all(
            holidays.map(async (holiday) => {
                const createdByName = await getUserNameById(holiday.createdBy);
                return {
                    ...holiday,
                    createdByName
                };
            })
        );
        
        sendSuccess(res, holidaysWithUserNames, 'Custom holidays fetched successfully');
    } catch (error) {
        console.error('Error fetching custom holidays by year and month:', error);
        sendError(res, 'Failed to fetch custom holidays by year and month', 500);
    }
});

  return router;
};
