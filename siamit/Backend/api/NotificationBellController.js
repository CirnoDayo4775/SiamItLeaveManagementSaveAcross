const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { In } = require('typeorm');

module.exports = (AppDataSource) => {
  const router = express.Router();
  const leaveRepo = AppDataSource.getRepository('LeaveRequest');
  const leaveTypeRepo = AppDataSource.getRepository('LeaveType');

  // Constants to avoid magic strings
  const TARGET_STATUSES = ['approved', 'rejected', 'deleted'];

  // GET: Unread notifications for current user
  router.get('/notifications', authMiddleware, async (req, res) => {
    try {
      const { userId } = req.user;

      // 1. Fetch unread notifications
      const notifications = await leaveRepo.find({
        where: {
          Repid: userId,
          isRead: false,
          status: In(TARGET_STATUSES)
        },
        select: ['id', 'startDate', 'endDate', 'status', 'leaveType'],
        order: { createdAt: 'DESC' } // Added sorting usually needed for notifications
      });

      // Optimization: Return early if no notifications
      if (!notifications.length) {
        return res.json({ status: 'success', data: [] });
      }

      // 2. Extract unique LeaveType IDs to fetch only what's needed
      const leaveTypeIds = [...new Set(notifications.map(n => n.leaveType).filter(Boolean))];
      
      // 3. Fetch related LeaveTypes
      const leaveTypes = await leaveTypeRepo.find({
        where: { id: In(leaveTypeIds) },
        select: ['id', 'leave_type_th', 'leave_type_en']
      });

      // 4. Create lookup map (O(1) access)
      const leaveTypeMap = leaveTypes.reduce((acc, type) => {
        acc[type.id] = {
          name_th: type.leave_type_th,
          name_en: type.leave_type_en
        };
        return acc;
      }, {});

      // 5. Transform data
      const data = notifications.map(n => ({
        id: n.id,
        startDate: n.startDate,
        endDate: n.endDate,
        status: n.status,
        leaveType: leaveTypeMap[n.leaveType] || { name_th: 'Unknown', name_en: 'Unknown' }
      }));

      res.json({ status: 'success', data });
    } catch (err) {
      console.error('Error fetching notifications:', err);
      res.status(500).json({ status: 'error', data: null, message: err.message });
    }
  });

  // POST: Mark ALL notifications as read
  router.post('/notifications/read', authMiddleware, async (req, res) => {
    try {
      const { userId } = req.user;

      // Use repo.update for cleaner syntax than QueryBuilder
      await leaveRepo.update(
        {
          Repid: userId,
          isRead: false,
          status: In(TARGET_STATUSES)
        },
        { isRead: true }
      );

      res.json({ status: 'success' });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // POST: Mark SINGLE notification as read
  router.post('/notifications/:id/read', authMiddleware, async (req, res) => {
    try {
      const { userId } = req.user;
      const notificationId = req.params.id;

      const result = await leaveRepo.update(
        {
          id: notificationId,
          Repid: userId,
          isRead: false,
          status: In(TARGET_STATUSES)
        },
        { isRead: true }
      );

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