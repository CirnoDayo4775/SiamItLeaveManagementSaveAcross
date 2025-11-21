const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();
const { Between } = require('typeorm');
const config = require('../config');
const { 
  convertToMinutes, 
  calculateDaysBetween,
  convertTimeRangeToDecimal
} = require('../utils');

module.exports = (AppDataSource) => {
  // Test endpoint to verify database connection
  router.get('/test-db', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.userId;
      console.log('Test DB endpoint - userId:', userId);
      
      const leaveRepo = AppDataSource.getRepository('LeaveRequest');
      const count = await leaveRepo.count({ where: { Repid: userId } });
      
      res.json({ 
        status: 'success', 
        data: { 
          userId, 
          totalLeaveRequests: count,
          message: 'Database connection working'
        } 
      });
    } catch (err) {
      console.error('Test DB error:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  router.get('/dashboard-stats', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.userId;
      console.log('Dashboard stats requested for userId:', userId);
      
      const leaveRepo = AppDataSource.getRepository('LeaveRequest');
      const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
      
      // --- เพิ่ม filter เดือน/ปี และ user เฉพาะคนนั้น ---
      const month = req.query.month ? parseInt(req.query.month) : null;
      const year = req.query.year ? parseInt(req.query.year) : null;
      console.log('Filter params - month:', month, 'year:', year);
      
      let where = { Repid: userId };
      if (month && year) {
        // filter เฉพาะ startDate ที่อยู่ในเดือน/ปีนั้น
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);
        console.log('Date range - start:', startDate, 'end:', endDate);
        where = {
          ...where,
          startDate: Between(startDate, endDate)
        };
      } else if (year) {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
        console.log('Date range - start:', startDate, 'end:', endDate);
        where = {
          ...where,
          startDate: Between(startDate, endDate)
        };
      }
      console.log('Query where clause:', JSON.stringify(where, null, 2));
      
      const leaveHistory = await leaveRepo.find({ where });
      console.log('Found leave history count:', leaveHistory.length);
      
                   // Calculate days and hours used from approved leave requests (using LeaveRequest table for filtering)
      let daysUsed = 0;
      let hoursUsed = 0;
      
      // Filter only approved requests for calculation
      const approvedRequests = leaveHistory.filter(lr => lr.status === 'approved');
      
      for (const request of approvedRequests) {
        if (request.startDate && request.endDate) {
          // Calculate days between start and end date
          const startDate = new Date(request.startDate);
          const endDate = new Date(request.endDate);
          const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          
          if (request.startTime && request.endTime) {
            // Hour-based leave
            const startTime = new Date(`2000-01-01T${request.startTime}`);
            const endTime = new Date(`2000-01-01T${request.endTime}`);
            const hoursDiff = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
            
            if (daysDiff === 1) {
              // Same day leave - add hours
              hoursUsed += hoursDiff;
            } else {
              // Multi-day leave - add full days
              daysUsed += daysDiff;
            }
          } else {
            // Full day leave
            daysUsed += daysDiff;
          }
        }
      }
      
      // Convert hours to days if >= working hours per day
      let remainingHours = 0;
      try {
        const additionalDays = Math.floor(hoursUsed / config.business.workingHoursPerDay);
        remainingHours = Math.round(hoursUsed % config.business.workingHoursPerDay);
        daysUsed += additionalDays;
        console.log('Converted hours to days:', additionalDays, 'remaining hours:', remainingHours);
      } catch (calcError) {
        console.error('Error in final calculations:', calcError);
      }
      
      // Calculate leave type stats from LeaveRequest table
      const leaveTypeStats = {};
      for (const request of approvedRequests) {
        let leaveTypeName = request.leaveType;
        
        // Get leave type name if it's an ID
        if (leaveTypeName && leaveTypeName.length > 20) {
          // Use raw query to include soft-deleted records
          const leaveTypeQuery = `SELECT * FROM leave_type WHERE id = ?`;
          const [leaveTypeResult] = await AppDataSource.query(leaveTypeQuery, [leaveTypeName]);
          const leaveType = leaveTypeResult ? leaveTypeResult[0] : null;
          if (leaveType) {
                      if (leaveType.is_active === false) {
            // Add [DELETED] prefix for inactive/deleted leave types
            leaveTypeName = '[DELETED] ' + (leaveType.leave_type_th || leaveTypeName);
          } else {
            leaveTypeName = leaveType.leave_type_th || leaveTypeName;
          }
          }
        }
        
        if (!leaveTypeStats[leaveTypeName]) {
          leaveTypeStats[leaveTypeName] = 0;
        }
        
        // Calculate days for this request
        if (request.startDate && request.endDate) {
          const startDate = new Date(request.startDate);
          const endDate = new Date(request.endDate);
          const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          
          if (request.startTime && request.endTime) {
            const startTime = new Date(`2000-01-01T${request.startTime}`);
            const endTime = new Date(`2000-01-01T${request.endTime}`);
            const hoursDiff = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
            
            if (daysDiff === 1) {
              leaveTypeStats[leaveTypeName] += hoursDiff / config.business.workingHoursPerDay;
            } else {
              leaveTypeStats[leaveTypeName] += daysDiff;
            }
          } else {
            leaveTypeStats[leaveTypeName] += daysDiff;
          }
        }
      }
             // Pending requests for this user
       const pendingRequests = leaveHistory.filter(lr => lr.status === 'pending').length;
       // Approved requests count
       const approvedRequestsCount = leaveHistory.filter(lr => lr.status === 'approved').length;
             // Approval rate
       const totalRequests = leaveHistory.length;
       const approvalRate = totalRequests > 0 ? Math.round((approvedRequestsCount / totalRequests) * 100) : 0;
      // Remaining days (configurable limit)
      const remainingDays = Math.max(0, config.business.maxLeaveDays - daysUsed);
      
      console.log('Final stats - daysUsed:', daysUsed, 'hoursUsed:', remainingHours, 'remainingDays:', remainingDays);
      
      res.json({
        status: 'success',
        data: {
          leaveHistory,
          daysUsed,
          hoursUsed: remainingHours, // ชั่วโมงที่เหลือหลังแปลงเป็นวัน
          pendingRequests,
          approvalRate,
          remainingDays,
          leaveTypeStats
        },
        message: 'Dashboard stats fetched successfully'
      });
    } catch (err) {
      console.error('Dashboard stats error:', err);
      console.error('Error stack:', err.stack);
      res.status(500).json({ status: 'error', data: null, message: err.message });
    }
  });

        // New API: /day-used - total leave duration for current user (days/hours)
  router.get('/day-used', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.userId;
      const leaveRepo = AppDataSource.getRepository('LeaveRequest');
      const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
      const month = req.query.month ? parseInt(req.query.month) : null;
      const year = req.query.year ? parseInt(req.query.year) : null;
      let where = { Repid: userId, status: 'approved' };
      if (month && year) {
        where = {
          ...where,
          startDate: Between(
            new Date(year, month - 1, 1),
            new Date(year, month, 0, 23, 59, 59, 999)
          )
        };
      } else if (year) {
        where = {
          ...where,
          startDate: Between(
            new Date(year, 0, 1),
            new Date(year, 11, 31, 23, 59, 59, 999)
          )
        };
      }
             // Get approved leave requests with filtering
       const approvedRequests = await leaveRepo.find({ where });
       
       // Calculate total days and hours from LeaveRequest table
       let totalDays = 0;
       let totalHours = 0;
       
       for (const request of approvedRequests) {
         if (request.startDate && request.endDate) {
           // Calculate days between start and end date
           const startDate = new Date(request.startDate);
           const endDate = new Date(request.endDate);
           const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
           
           if (request.startTime && request.endTime) {
             // Hour-based leave
             const startTime = new Date(`2000-01-01T${request.startTime}`);
             const endTime = new Date(`2000-01-01T${request.endTime}`);
             const hoursDiff = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
             
             if (daysDiff === 1) {
               // Same day leave - add hours
               totalHours += hoursDiff;
             } else {
               // Multi-day leave - add full days
               totalDays += daysDiff;
             }
           } else {
             // Full day leave
             totalDays += daysDiff;
           }
         }
       }
       
       // Convert hours to days if >= working hours per day
       const additionalDays = Math.floor(totalHours / config.business.workingHoursPerDay);
       const remainingHours = Math.round(totalHours % config.business.workingHoursPerDay);
       totalDays += additionalDays;
       
       res.json({ status: 'success', data: { days: totalDays, hours: remainingHours } });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  router.get('/recent-leave-requests', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.userId;
      const leaveRepo = AppDataSource.getRepository('LeaveRequest');
      const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
      const month = req.query.month ? parseInt(req.query.month) : null;
      const year = req.query.year ? parseInt(req.query.year) : null;
      

      
      let where = { Repid: userId };
      if (month && year) {
        where = {
          ...where,
          startDate: Between(
            new Date(year, month - 1, 1),
            new Date(year, month, 0, 23, 59, 59, 999)
          )
        };
      } else if (year) {
        where = {
          ...where,
          startDate: Between(
            new Date(year, 0, 1),
            new Date(year, 11, 31, 23, 59, 59, 999)
          )
        };
      }
      
      // Find 3 most recent leave requests
      const leaveRequests = await leaveRepo.find({ where, order: { createdAt: 'DESC' }, take: 3 });
      
      const result = [];
      for (const lr of leaveRequests) {
        let leaveTypeId = lr.leaveType;
        let leaveTypeNameTh = '';
        let leaveTypeNameEn = '';
        
        // Always try to resolve leave type names from the leave_types table
        if (leaveTypeId) {
          try {
            // Try using the repository first (more reliable)
            let leaveType = null;
            try {
              leaveType = await leaveTypeRepo.findOne({ where: { id: leaveTypeId } });
            } catch (repoError) {
              // Fallback to raw query
              const leaveTypeQuery = `SELECT id, leave_type_th, leave_type_en, is_active FROM leave_type WHERE id = ?`;
              const [leaveTypeResult] = await AppDataSource.query(leaveTypeQuery, [leaveTypeId]);
              
              if (leaveTypeResult && leaveTypeResult.length > 0) {
                leaveType = leaveTypeResult[0];
              }
            }
            
            if (leaveType) {
              // Always use the actual names from the database, regardless of active status
              leaveTypeNameTh = leaveType.leave_type_th || leaveTypeId;
              leaveTypeNameEn = leaveType.leave_type_en || leaveTypeId;
            } else {
              // If no leave type found, use the ID as fallback
              leaveTypeNameTh = leaveTypeId;
              leaveTypeNameEn = leaveTypeId;
            }
          } catch (error) {
            console.error('Error fetching leave type:', error);
            // Fallback to ID if there's an error
            leaveTypeNameTh = leaveTypeId;
            leaveTypeNameEn = leaveTypeId;
          }
        } else {
          // If no leaveType, set default values
          leaveTypeNameTh = 'Unknown Type';
          leaveTypeNameEn = 'Unknown Type';
        }
        
        // Calculate duration
        let duration = '';
        if (lr.startTime && lr.endTime) {
          // Hour-based leave
          const startMinutes = convertToMinutes(...lr.startTime.split(':').map(Number));
          const endMinutes = convertToMinutes(...lr.endTime.split(':').map(Number));
          let durationHours = (endMinutes - startMinutes) / 60;
          if (durationHours < 0 || isNaN(durationHours)) durationHours = 0;
          // Show only whole numbers (round down)
          duration = `${Math.floor(durationHours)} hour`;
          
        } else if (lr.startDate && lr.endDate) {
          // Day-based leave
          const start = new Date(lr.startDate);
          const end = new Date(lr.endDate);
          let days = calculateDaysBetween(start, end);
          if (days < 0 || isNaN(days)) days = 0;
          duration = `${days} day`;
        }
        
        const resultItem = {
          leavetype: leaveTypeId, // Keep the original ID for reference
          leavetype_th: leaveTypeNameTh, // Thai name
          leavetype_en: leaveTypeNameEn, // English name
          duration,
          startdate: lr.startDate,
          status: lr.status
        };
        
        result.push(resultItem);
      }
      
      res.json({ status: 'success', data: result });
    } catch (err) {
      console.error('Error in recent-leave-requests:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  router.get('/my-backdated', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.userId;
      const leaveRepo = AppDataSource.getRepository('LeaveRequest');
      const month = req.query.month ? parseInt(req.query.month) : null;
      const year = req.query.year ? parseInt(req.query.year) : null;
      let where = { Repid: userId, backdated: true };
      if (month && year) {
        where = {
          ...where,
          startDate: Between(
            new Date(year, month - 1, 1),
            new Date(year, month, 0, 23, 59, 59, 999)
          )
        };
      } else if (year) {
        where = {
          ...where,
          startDate: Between(
            new Date(year, 0, 1),
            new Date(year, 11, 31, 23, 59, 59, 999)
          )
        };
      }
      // Count leave requests created by this user where backdated === true and matches filter
      const count = await leaveRepo.count({ where });
      res.json({ status: 'success', data: { count } });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // New API: /user-profile - Get current user profile information for card display
  router.get('/user-profile', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.userId;
      
      // Get repositories
      const userRepo = AppDataSource.getRepository('User');
      const departmentRepo = AppDataSource.getRepository('Department');
      const positionRepo = AppDataSource.getRepository('Position');

      // Find user directly in unified users table
      const userProfile = await userRepo.findOne({ where: { id: userId } });
      if (!userProfile) {
        return res.status(404).json({ 
          status: 'error', 
          message: 'User not found' 
        });
      }

      // Get user role and name from unified table
      const role = userProfile.Role;
      const userName = userProfile.name || '';

      // Get department information
      let departmentInfo = {
        id: null,
        name_th: 'No Department',
        name_en: 'No Department'
      };
      if (userProfile.department) {
        const department = await departmentRepo.findOne({ where: { id: userProfile.department } });
        if (department) {
          departmentInfo = {
            id: department.id,
            name_th: department.department_name_th || 'No Department',
            name_en: department.department_name_en || 'No Department'
          };
        }
      }

      // Get position information
      let positionInfo = {
        id: null,
        name_th: 'No Position',
        name_en: 'No Position'
      };
      if (userProfile.position) {
        const position = await positionRepo.findOne({ where: { id: userProfile.position } });
        if (position) {
          positionInfo = {
            id: position.id,
            name_th: position.position_name_th || 'No Position',
            name_en: position.position_name_en || 'No Position'
          };
        }
      }

      res.json({
        status: 'success',
        data: {
          name: userName,
          email: userProfile.Email,
          avatar: userProfile.avatar_url,
          role: role,
          department: departmentInfo,
          position: positionInfo
        },
        message: 'User profile fetched successfully'
      });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });
  
  return router;
};

