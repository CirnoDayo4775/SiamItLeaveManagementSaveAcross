const express = require('express');
const router = express.Router();
const LeaveUsedController = require('../api/LeaveUsedController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /api/leave-used - Get all leave used records
router.get('/', LeaveUsedController.getAllLeaveUsed);

// GET /api/leave-used/user/:userId - Get leave used records by user ID
router.get('/user/:userId', LeaveUsedController.getLeaveUsedByUserId);

// GET /api/leave-used/type/:leaveType - Get leave used records by leave type
router.get('/type/:leaveType', LeaveUsedController.getLeaveUsedByType);

// GET /api/leave-used/summary/:userId - Get leave usage summary for a user
router.get('/summary/:userId', LeaveUsedController.getUserLeaveSummary);

// GET /api/leave-used/statistics - Get leave usage statistics
router.get('/statistics', LeaveUsedController.getLeaveStatistics);

// POST /api/leave-used - Create new leave used record
router.post('/', LeaveUsedController.createLeaveUsed);

// PUT /api/leave-used/:id - Update leave used record
router.put('/:id', LeaveUsedController.updateLeaveUsed);

// DELETE /api/leave-used/:id - Delete leave used record
router.delete('/:id', LeaveUsedController.deleteLeaveUsed);

module.exports = router;
