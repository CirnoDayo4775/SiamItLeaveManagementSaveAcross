const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { announcementImageUpload, handleUploadError } = require('../middleware/fileUploadMiddleware');

module.exports = (AppDataSource) => {
  const router = express.Router();
  const uploadsDir = path.join(__dirname, '../uploads');
  const announcementDir = path.join(uploadsDir, 'announcements');

  // --- Helper Functions ---

  /**
   * Helper function to safely delete an image file
   * Handles check existence, unlink, and fallback to rmSync
   */
  const deleteOldImage = (filename) => {
    if (!filename) return;

    const filePath = path.join(announcementDir, filename);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        // Double check
        if (!fs.existsSync(filePath)) {
          console.log(`✅ HARD DELETED image: ${filename}`);
        } else {
          // Fallback force delete
          fs.rmSync(filePath, { force: true });
          console.log(`✅ Force deleted image: ${filename}`);
        }
      } else {
        console.log(`⚠️ Image file not found (already deleted?): ${filename}`);
      }
    } catch (err) {
      console.error(`❌ Error deleting image ${filename}:`, err.message);
      // Last resort attempt
      try {
        fs.rmSync(filePath, { force: true });
      } catch (e) { /* ignore */ }
    }
  };

  /**
   * Helper to emit socket events
   */
  const emitSocketEvent = (eventName, data) => {
    if (global.io) {
      global.io.emit(eventName, data);
    }
  };

  // --- Routes ---


  router.get('/announcements', async (req, res) => {
    try {
      const announcementRepo = AppDataSource.getRepository('Announcements');
      const announcements = await announcementRepo.find();

      console.log(`Fetched ${announcements.length} announcements`);

      const data = announcements.map(a => ({
        id: a.id,
        subject: a.subject,
        imagePath: a.Image
      }));

      res.json({ status: 'success', data: announcements, message: 'Fetched all announcements' });
    } catch (err) {
      console.error('Error fetching announcements:', err);
      res.status(500).json({ status: 'error', data: null, message: err.message });
    }
  });


  router.get('/announcements/feed', async (req, res) => {
    try {
      const announcementRepo = AppDataSource.getRepository('Announcements');
      const userRepo = AppDataSource.getRepository('User');

      // 1. Get all announcements sorted by date
      const announcements = await announcementRepo.find({
        order: { createdAt: 'DESC' }
      });

      if (!announcements.length) {
        return res.json({ status: 'success', data: [], message: 'No announcements found' });
      }

      // 2. Optimization: Extract unique User IDs to fetch in one query (Avoid N+1 problem)
      const userIds = [...new Set(announcements.map(a => a.createdBy).filter(Boolean))];
      
      let userMap = {};
      if (userIds.length > 0) {
        // Use QueryBuilder to avoid importing 'In' operator dependency issues
        const users = await userRepo.createQueryBuilder("user")
          .where("user.id IN (:...ids)", { ids: userIds })
          .getMany();
        
        // Create a map for O(1) lookup: { userId: userObject }
        userMap = users.reduce((acc, user) => {
          acc[user.id] = user;
          return acc;
        }, {});
      }

      // 3. Map announcements with user data from memory
      const announcementsWithAvatar = announcements.map(announcement => {
        const user = userMap[announcement.createdBy];
        return {
          id: announcement.id,
          subject: announcement.subject,
          detail: announcement.detail,
          createdAt: announcement.createdAt,
          createdBy: announcement.createdBy,
          createdByName: user?.name || 'Unknown User',
          Image: announcement.Image,
          avatar: user?.avatar_url || null
        };
      });

      res.json({
        status: 'success',
        data: announcementsWithAvatar,
        message: 'Fetched all announcements with avatar data'
      });
    } catch (err) {
      console.error('Error fetching announcements feed:', err);
      res.status(500).json({ status: 'error', data: null, message: err.message });
    }
  });


  router.get('/announcements/:id', async (req, res) => {
    try {
      const announcementRepo = AppDataSource.getRepository('Announcements');
      const announcement = await announcementRepo.findOneBy({ id: req.params.id });
      
      if (!announcement) {
        return res.status(404).json({ status: 'error', data: null, message: 'Announcement not found' });
      }
      
      res.json({ status: 'success', data: announcement, message: 'Fetched announcement' });
    } catch (err) {
      res.status(500).json({ status: 'error', data: null, message: err.message });
    }
  });


  router.post('/announcements', announcementImageUpload.single('Image'), async (req, res) => {
    try {
      const { subject, detail, createdBy } = req.body;
      const announcementRepo = AppDataSource.getRepository('Announcements');

      const newAnnouncement = announcementRepo.create({
        subject,
        detail,
        Image: req.file ? req.file.filename : null,
        createdBy: createdBy || null
      });

      const savedAnnouncement = await announcementRepo.save(newAnnouncement);

      emitSocketEvent('newAnnouncement', {
        id: savedAnnouncement.id,
        subject: savedAnnouncement.subject,
        detail: savedAnnouncement.detail,
        createdAt: savedAnnouncement.createdAt,
        createdBy: savedAnnouncement.createdBy,
        Image: savedAnnouncement.Image
      });

      res.json({ status: 'success', data: savedAnnouncement, message: 'Announcement created successfully' });
    } catch (err) {
      console.error('Error creating announcement:', err);
      res.status(500).json({ status: 'error', data: null, message: err.message });
    }
  });

 
  router.put('/announcements/:id', announcementImageUpload.single('Image'), async (req, res) => {
    try {
      const { id } = req.params;
      const { subject, detail, createdBy } = req.body;
      const announcementRepo = AppDataSource.getRepository('Announcements');

      const announcement = await announcementRepo.findOneBy({ id });
      if (!announcement) {
        return res.status(404).json({ status: 'error', data: null, message: 'Announcement not found' });
      }

      // Update fields if provided
      if (subject) announcement.subject = subject;
      if (detail) announcement.detail = detail;
      if (createdBy) announcement.createdBy = createdBy;

      // Handle Image Update
      if (req.file) {
        // Delete old image using helper
        if (announcement.Image) {
          deleteOldImage(announcement.Image);
        }
        announcement.Image = req.file.filename;
      }

      const updatedAnnouncement = await announcementRepo.save(announcement);

      emitSocketEvent('announcementUpdated', {
        id: updatedAnnouncement.id,
        subject: updatedAnnouncement.subject,
        detail: updatedAnnouncement.detail,
        createdAt: updatedAnnouncement.createdAt,
        createdBy: updatedAnnouncement.createdBy,
        Image: updatedAnnouncement.Image
      });

      res.json({ status: 'success', data: updatedAnnouncement, message: 'Announcement updated successfully' });
    } catch (err) {
      console.error('Error updating announcement:', err);
      res.status(500).json({ status: 'error', data: null, message: err.message });
    }
  });


  router.delete('/announcements/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const announcementRepo = AppDataSource.getRepository('Announcements');
      
      const announcement = await announcementRepo.findOneBy({ id });
      if (!announcement) {
        return res.status(404).json({ status: 'error', data: null, message: 'Announcement not found' });
      }

      // Delete image using helper
      if (announcement.Image) {
        deleteOldImage(announcement.Image);
      }

      // Store data for socket before deletion
      const deletedData = { ...announcement };

      await announcementRepo.delete({ id });

      emitSocketEvent('announcementDeleted', {
        id: deletedData.id,
        subject: deletedData.subject,
        detail: deletedData.subject, // Kept as per original code logic
        createdAt: deletedData.createdAt,
        createdBy: deletedData.createdBy,
        Image: deletedData.Image
      });

      res.json({ status: 'success', message: 'Announcement deleted successfully' });
    } catch (err) {
      console.error('Error deleting announcement:', err);
      res.status(500).json({ status: 'error', data: null, message: err.message });
    }
  });

  return router;
};