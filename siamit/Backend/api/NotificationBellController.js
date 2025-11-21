const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();
const { In } = require('typeorm');

module.exports = (AppDataSource) => {
  // Get unread notifications for current user
  router.get('/notifications', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.userId;
      const lang = (req.headers['accept-language'] || 'en').toLowerCase().startsWith('th') ? 'th' : 'en';
      const leaveRepo = AppDataSource.getRepository('LeaveRequest');
      const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
      
      // First get the notifications
      const notifications = await leaveRepo.find({
        where: {
          Repid: userId,
          isRead: false,
          status: In(['approved', 'rejected', 'deleted'])
        },
        select: ['id', 'startDate', 'endDate', 'status', 'leaveType']
      });

      // Get all leave types to map them
      const leaveTypes = await leaveTypeRepo.find({
        select: ['id', 'leave_type_th', 'leave_type_en']
      });

      // Create a map of leave type IDs to names
      const leaveTypeMap = {};
      leaveTypes.forEach(type => {
        leaveTypeMap[type.id] = {
          name_th: type.leave_type_th,
          name_en: type.leave_type_en
        };
      });

      // Transform the data to match the expected format
      const transformedNotifications = notifications.map(notification => ({
        id: notification.id,
        startDate: notification.startDate,
        endDate: notification.endDate,
        status: notification.status,
        leaveType: leaveTypeMap[notification.leaveType] || {
          name_th: '',
          name_en: ''
        }
      }));

      res.json({ status: 'success', data: transformedNotifications });
    } catch (err) {
      res.status(500).json({ status: 'error', data: null, message: err.message });
    }
  });

  // Mark all notifications as read for current user
  router.post('/notifications/read', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.userId;
      const leaveRepo = AppDataSource.getRepository('LeaveRequest');
      await leaveRepo
        .createQueryBuilder()
        .update()
        .set({ isRead: true })
        .where('Repid = :userId', { userId })
        .andWhere('isRead = false')
        .andWhere('status IN (:...statuses)', { statuses: ['approved', 'rejected', 'deleted'] })
        .execute();
      res.json({ status: 'success' });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Mark a single notification as read for current user
  router.post('/notifications/:id/read', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.userId;
      const notificationId = req.params.id;
      const leaveRepo = AppDataSource.getRepository('LeaveRequest');
      const result = await leaveRepo
        .createQueryBuilder()
        .update()
        .set({ isRead: true })
        .where('id = :id', { id: notificationId })
        .andWhere('Repid = :userId', { userId })
        .andWhere('isRead = false')
        .andWhere('status IN (:...statuses)', { statuses: ['approved', 'rejected', 'deleted'] })
        .execute();
      if (result.affected > 0) {
        res.json({ status: 'success' });
      } else {
        res.status(404).json({ status: 'error', message: 'Notification not found or already read.' });
      }
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  return router;
}; 