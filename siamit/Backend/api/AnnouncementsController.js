const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { announcementImageUpload, handleUploadError } = require('../middleware/fileUploadMiddleware');

module.exports = (AppDataSource) => {
  const router = express.Router();
  
  // Define uploads directory
  const uploadsDir = path.join(__dirname, '../uploads');

  // File upload middleware is now imported from fileUploadMiddleware.js

  /**
   * @swagger
   * /api/announcements:
   *   get:
   *     summary: Get all announcements
   *     tags:
   *       - Announcements
   *     responses:
   *       200:
   *         description: A list of announcements
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                 message:
   *                   type: string
   */
  // Get all announcements
  router.get('/announcements', async (req, res) => {
    try {
      const announcementRepo = AppDataSource.getRepository('Announcements');
      const announcements = await announcementRepo.find();
      
      console.log('Fetched announcements:', {
        count: announcements.length,
        announcements: announcements.map(a => ({
          id: a.id,
          subject: a.subject,
          imagePath: a.Image
        }))
      });
      
      res.json({ status: 'success', data: announcements, message: 'Fetched all announcements' });
    } catch (err) {
      console.error('Error fetching announcements:', err);
      res.status(500).json({ status: 'error', data: null, message: err.message });
    }
  });

  /**
   * @swagger
   * /api/announcements/feed:
   *   get:
   *     summary: Get all announcements with avatar data
   *     tags:
   *       - Announcements
   *     responses:
   *       200:
   *         description: A list of announcements with avatar data
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       subject:
   *                         type: string
   *                       detail:
   *                         type: string
   *                       createdAt:
   *                         type: string
   *                       createdBy:
   *                         type: string
   *                       Image:
   *                         type: string
   *                       avatar:
   *                         type: string
   *                 message:
   *                   type: string
   */
  // Get all announcements with avatar data
  router.get('/announcements/feed', async (req, res) => {
    try {
      const announcementRepo = AppDataSource.getRepository('Announcements');
      
      // Get all announcements
      const announcements = await announcementRepo.find({
        order: {
          createdAt: 'DESC'
        }
      });


      // Get avatar data and user names for each announcement
      const announcementsWithAvatar = await Promise.all(
        announcements.map(async (announcement) => {
          let avatar = null;
          let userName = 'Unknown User';
          
          if (announcement.createdBy) {
            // Find the user by ID in the unified User table
            const userRepo = AppDataSource.getRepository('User');
            
            // Find user in User table (unified table with Role field)
            let user = await userRepo.findOne({
              where: { id: announcement.createdBy }
            });
            
            // If user found, get their name and avatar
            if (user) {
              // Get user name from the unified User table
              if (user.name) {
                userName = user.name;
              }
              
              // Get avatar from the unified User table (avatar_url field)
              if (user.avatar_url) {
                avatar = user.avatar_url;
              }
            }
          }

          return {
            id: announcement.id,
            subject: announcement.subject,
            detail: announcement.detail,
            createdAt: announcement.createdAt,
            createdBy: announcement.createdBy, // This is now the user ID
            createdByName: userName, // This is the display name
            Image: announcement.Image,
            avatar: avatar
          };
        })
      );

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

  /**
   * @swagger
   * /api/announcements/{id}:
   *   get:
   *     summary: Get announcement by ID
   *     tags:
   *       - Announcements
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Announcement found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                 data:
   *                   type: object
   *                 message:
   *                   type: string
   *       404:
   *         description: Announcement not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                 data:
   *                   type: object
   *                 message:
   *                   type: string
   */
  // Get announcement by ID
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

  /**
   * @swagger
   * /api/announcements:
   *   post:
   *     summary: Create a new announcement
   *     tags:
   *       - Announcements
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               subject:
   *                 type: string
   *               detail:
   *                 type: string
   *               Image:
   *                 type: string
   *               createdBy:
   *                 type: string
   *     responses:
   *       200:
   *         description: Announcement created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                 data:
   *                   type: object
   *                 message:
   *                   type: string
   */
  // Create announcement
  router.post('/announcements', announcementImageUpload.single('Image'), async (req, res) => {
    try {
      const { subject, detail, createdBy } = req.body;
      
      const announcementRepo = AppDataSource.getRepository('Announcements');
      const newAnnouncement = announcementRepo.create({
        subject,
        detail,
        Image: req.file ? req.file.filename : null,
        createdBy: createdBy || null // This should now be a user ID
      });
      
      const savedAnnouncement = await announcementRepo.save(newAnnouncement);
      
      // Emit Socket.io event for real-time notification
      if (global.io) {
        global.io.emit('newAnnouncement', {
          id: savedAnnouncement.id,
          subject: savedAnnouncement.subject,
          detail: savedAnnouncement.detail,
          createdAt: savedAnnouncement.createdAt,
          createdBy: savedAnnouncement.createdBy, // User ID
          Image: savedAnnouncement.Image
        });
      }
      
      res.json({ status: 'success', data: savedAnnouncement, message: 'Announcement created successfully' });
    } catch (err) {
      console.error('Error creating announcement:', err);
      res.status(500).json({ status: 'error', data: null, message: err.message });
    }
  });

  /**
   * @swagger
   * /api/announcements/{id}:
   *   put:
   *     summary: Update an announcement
   *     tags:
   *       - Announcements
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               subject:
   *                 type: string
   *               detail:
   *                 type: string
   *               Image:
   *                 type: string
   *               createdBy:
   *                 type: string
   *     responses:
   *       200:
   *         description: Announcement updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                 data:
   *                   type: object
   *                 message:
   *                   type: string
   *       404:
   *         description: Announcement not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                 data:
   *                   type: object
   *                 message:
   *                   type: string
   */
  // Update announcement
  router.put('/announcements/:id', announcementImageUpload.single('Image'), async (req, res) => {
    try {
      const { id } = req.params;
      const { subject, detail, createdBy } = req.body;
      
      const announcementRepo = AppDataSource.getRepository('Announcements');
      const announcement = await announcementRepo.findOneBy({ id });
      
      if (!announcement) {
        return res.status(404).json({ status: 'error', data: null, message: 'Announcement not found' });
      }
      
      // Update fields
      announcement.subject = subject || announcement.subject;
      announcement.detail = detail || announcement.detail;
      if (createdBy) {
        announcement.createdBy = createdBy;
      }
      
      if (req.file) {
        // HARD DELETE old image if exists
        if (announcement.Image) {
          const oldImagePath = path.join(uploadsDir, 'announcements', announcement.Image);
          
          try {
            if (fs.existsSync(oldImagePath)) {
              // Force delete the old announcement image file (hard delete)
              fs.unlinkSync(oldImagePath);
              
              // Verify file is actually deleted
              if (!fs.existsSync(oldImagePath)) {
                console.log(`✅ HARD DELETED old announcement image: ${announcement.Image}`);
              } else {
                console.error(`❌ FAILED to delete old announcement image: ${announcement.Image} - file still exists`);
                
                // Try alternative deletion method
                try {
                  fs.rmSync(oldImagePath, { force: true });
                  console.log(`✅ Force deleted old announcement image: ${announcement.Image}`);
                } catch (forceDeleteError) {
                  console.error(`❌ Force delete also failed for old announcement image: ${announcement.Image}:`, forceDeleteError.message);
                }
              }
            } else {
              console.log(`⚠️  Old announcement image file not found (already deleted?): ${announcement.Image}`);
            }
          } catch (fileDeleteError) {
            console.error(`❌ Error deleting old announcement image file ${announcement.Image}:`, fileDeleteError.message);
            
            // Try alternative deletion method
            try {
              fs.rmSync(oldImagePath, { force: true });
              console.log(`✅ Force deleted old announcement image: ${announcement.Image}`);
            } catch (forceDeleteError) {
              console.error(`❌ Force delete also failed for old announcement image: ${announcement.Image}:`, forceDeleteError.message);
            }
          }
        }
        announcement.Image = req.file.filename;
      }
      
      const updatedAnnouncement = await announcementRepo.save(announcement);
      
      // Emit Socket.io event for real-time notification
      if (global.io) {
        global.io.emit('announcementUpdated', {
          id: updatedAnnouncement.id,
          subject: updatedAnnouncement.subject,
          detail: updatedAnnouncement.detail,
          createdAt: updatedAnnouncement.createdAt,
          createdBy: updatedAnnouncement.createdBy, // User ID
          Image: updatedAnnouncement.Image
        });
      }
      
      res.json({ status: 'success', data: updatedAnnouncement, message: 'Announcement updated successfully' });
    } catch (err) {
      console.error('Error updating announcement:', err);
      res.status(500).json({ status: 'error', data: null, message: err.message });
    }
  });

  /**
   * @swagger
   * /api/announcements/{id}:
   *   delete:
   *     summary: Delete an announcement
   *     tags:
   *       - Announcements
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Announcement deleted
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                 data:
   *                   type: object
   *                 message:
   *                   type: string
   *       404:
   *         description: Announcement not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                 data:
   *                   type: object
   *                 message:
   *                   type: string
   */
  // Delete announcement
  router.delete('/announcements/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      const announcementRepo = AppDataSource.getRepository('Announcements');
      const announcement = await announcementRepo.findOneBy({ id });
      
      if (!announcement) {
        return res.status(404).json({ status: 'error', data: null, message: 'Announcement not found' });
      }
      
      // HARD DELETE image file if exists
      if (announcement.Image) {
        const imagePath = path.join(uploadsDir, 'announcements', announcement.Image);
        
        try {
          if (fs.existsSync(imagePath)) {
            // Force delete the announcement image file (hard delete)
            fs.unlinkSync(imagePath);
            
            // Verify file is actually deleted
            if (!fs.existsSync(imagePath)) {
              console.log(`✅ HARD DELETED announcement image: ${announcement.Image}`);
            } else {
              console.error(`❌ FAILED to delete announcement image: ${announcement.Image} - file still exists`);
              
              // Try alternative deletion method
              try {
                fs.rmSync(imagePath, { force: true });
                console.log(`✅ Force deleted announcement image: ${announcement.Image}`);
              } catch (forceDeleteError) {
                console.error(`❌ Force delete also failed for announcement image: ${announcement.Image}:`, forceDeleteError.message);
              }
            }
          } else {
            console.log(`⚠️  Announcement image file not found (already deleted?): ${announcement.Image}`);
          }
        } catch (fileDeleteError) {
          console.error(`❌ Error deleting announcement image file ${announcement.Image}:`, fileDeleteError.message);
          
          // Try alternative deletion method
          try {
            fs.rmSync(imagePath, { force: true });
            console.log(`✅ Force deleted announcement image: ${announcement.Image}`);
          } catch (forceDeleteError) {
            console.error(`❌ Force delete also failed for announcement image: ${announcement.Image}:`, forceDeleteError.message);
          }
        }
      }
      
      await announcementRepo.delete({ id });
      
      // Emit Socket.io event for real-time notification
      if (global.io) {
        global.io.emit('announcementDeleted', {
          id: announcement.id,
          subject: announcement.subject,
          detail: announcement.subject,
          createdAt: announcement.createdAt,
          createdBy: announcement.createdBy, // User ID
          Image: announcement.Image
        });
      }
      
      res.json({ status: 'success', message: 'Announcement deleted successfully' });
    } catch (err) {
      console.error('Error deleting announcement:', err);
      res.status(500).json({ status: 'error', data: null, message: err.message });
    }
  });

  return router;
};