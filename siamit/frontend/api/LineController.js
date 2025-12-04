const line = require('@line/bot-sdk');
const axios = require('axios');
const { Between } = require('typeorm');
require('dotenv').config();

const { 
  toDayHour, 
  calculateDaysBetween, 
  convertTimeRangeToDecimal,
  convertToMinutes,
  getLeaveUsageSummary
} = require('../utils');

// LINE Bot configuration using environment variables
const config = {
  channelAccessToken: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_BOT_CHANNEL_SECRET
};

// Debug: Log LINE Bot configuration (without exposing sensitive data)
console.log('LINE Bot Configuration Debug:');
console.log('Channel Access Token exists:', !!process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN);
console.log('Channel Secret exists:', !!process.env.LINE_BOT_CHANNEL_SECRET);
console.log('Channel Access Token length:', process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN ? process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN.length : 0);
console.log('Channel Secret length:', process.env.LINE_BOT_CHANNEL_SECRET ? process.env.LINE_BOT_CHANNEL_SECRET.length : 0);

// Helper function to get API base URL
const getApiBaseUrl = () => {
  return 'https://krista-nonmutable-evolutionally.ngrok-free.dev';
};

const client = new line.Client(config);

class LineController {
  // Webhook endpoint for LINE to send messages
  static async webhook(req, res) {
    const events = req.body.events;
    
    try {
      await Promise.all(events.map(event => LineController.handleEvent(event)));
      res.json({ success: true });
    } catch (err) {
      console.error('LINE webhook error:', err);
      res.status(500).json({ error: err.message });
    }
  }

  // Handle incoming LINE events
  static async handleEvent(event) {
    // Handle different event types
    switch (event.type) {
      case 'message':
        if (event.message.type === 'text') {
          return await this.handleTextMessage(event);
        }
        break;
      case 'follow':
        return await this.handleFollow(event);
      default:
        return Promise.resolve(null);
    }
  }

  // Handle text messages
  static async handleTextMessage(event) {
    const text = event.message.text;
    const userId = event.source.userId;
    const replyToken = event.replyToken;

    try {
      const response = await this.processUserMessage(text, userId);
      await client.replyMessage(replyToken, response);
    } catch (error) {
      console.error('Error processing LINE message:', error);
      await client.replyMessage(replyToken, {
        type: 'text',
        text: 'Sorry, something went wrong. Please try again.'
      });
    }
  }

  // Handle follow events (when user adds the bot)
  static async handleFollow(event) {
    const userId = event.source.userId;
    const replyToken = event.replyToken;

    try {
      // Send welcome message
      const welcomeMessage = {
        type: 'text',
        text: `🎉 Welcome to SiamIT Leave Management Bot!

I'm here to help you manage your leave requests and check your status.

Use the menu below to get started!

To link your account for full access, please visit the web application and use LINE Login.`
      };
      
      await client.replyMessage(replyToken, welcomeMessage);
    } catch (error) {
      console.error('Error handling follow event:', error);
    }
  }

  // Get AppDataSource (we'll need to pass this from the main app)
  static getAppDataSource() {
    // This will be set from the main app
    return global.AppDataSource;
  }

  // Process user message and call appropriate API
  static async processUserMessage(message, userId) {
    const command = message.toLowerCase().trim();

    // Commands that don't need user linking
    const publicCommands = ['help', 'announcements', 'request', 'recent announcements', 'leave management web site', 'company holidays', 'annual holidays'];
    
    let user = null;
    if (!publicCommands.includes(command)) {
      // Check if user is linked
      const userRepo = global.AppDataSource.getRepository('User');
      user = await userRepo.findOneBy({ lineUserId: userId });
      
      if (!user) {
        return {
          type: 'text',
          text: `🔗 Please link your LINE account first!\n\nTo link your account, go to the web application and use the LINE Login feature.\n\nCommands that work without linking:\n- help\n- announcements\n- request\n- recent announcements\n- leave management web site\n- company holidays\n- annual holidays`
        };
      }
    }

    switch (command) {
      case 'help':
        return this.getHelpMessage();

      case 'status':
      case 'recent leave':
        return await this.getLeaveStatus(user);

      case 'balance':
      case 'leave entitlements':
        return await this.getLeaveBalance(user);

      case 'history':
        return await this.getLeaveHistory(user);

      case 'profile':
        return await this.getUserProfile(user);

      case 'announcements':
      case 'recent announcements':
        return await this.getAnnouncements();

      case 'request':
        return this.getRequestInstructions();

      case 'leave management web site':
        return this.getLeaveWebsiteMessage();

      case 'company holidays':
        return await this.getCompanyHolidays();

      case 'annual holidays':
        return await this.getAnnualHolidays();

      default:
        return this.getHelpMessage();
    }
  }

static async getLeaveStatus(user) {
    try {
      const leaveRepo = global.AppDataSource.getRepository('LeaveRequest');
      const leaveTypeRepo = global.AppDataSource.getRepository('LeaveType');
      
      // 1. ดึงชื่อผู้ใช้ (ใช้ Raw SQL เพื่อป้องกัน Error เรื่อง Entity)
      let userName = 'ไม่ระบุชื่อ';
      try {
        const [userResult] = await global.AppDataSource.query(
          `SELECT name FROM users WHERE id = ?`, 
          [user.id]
        );
        if (userResult) {
          userName = userResult.name;
        }
      } catch (err) {
        console.log('Could not fetch user name:', err);
      }

      // 2. ค้นหาใบลา 3 รายการล่าสุด
      const leaveRequests = await leaveRepo.find({ 
        where: { Repid: user.id }, 
        order: { createdAt: 'DESC' }, 
        take: 3 
      });

      // ฟังก์ชันแปลงสถานะเป็นไทย
      function getStatusDisplay(status) {
        switch (status.toLowerCase()) {
          case 'approved': return 'อนุมัติ';
          case 'pending': return 'รออนุมัติ';
          case 'rejected': return 'ไม่อนุมัติ';
          default: return status;
        }
      }

      // เริ่มต้นข้อความ
      let message = `📋 รายการลาล่าสุด: ${userName}\n\n`;
      
      if (leaveRequests.length === 0) {
        message += 'ไม่พบประวัติการลาล่าสุด';
      } else {
        for (const lr of leaveRequests) {
          // --- จัดการชื่อประเภทการลา ---
          let leaveTypeNameTh = lr.leaveType;
          let leaveTypeNameEn = lr.leaveType;
          
          if (lr.leaveType && lr.leaveType.length > 20) {
            // กรณีเป็น ID (UUID)
            const leaveTypeQuery = `SELECT * FROM leave_type WHERE id = ?`;
            const [leaveTypeResult] = await global.AppDataSource.query(leaveTypeQuery, [lr.leaveType]);
            const leaveType = leaveTypeResult ? leaveTypeResult : null;
            
            if (leaveType) {
               if (leaveType.is_active === false || leaveType.is_active === 0) {
                 const prefix = '[ถูกลบ] ';
                 leaveTypeNameTh = prefix + (leaveType.leave_type_th || lr.leaveType);
                 leaveTypeNameEn = prefix + (leaveType.leave_type_en || lr.leaveType);
               } else {
                 leaveTypeNameTh = leaveType.leave_type_th || lr.leaveType;
                 leaveTypeNameEn = leaveType.leave_type_en || lr.leaveType;
               }
            }
          } else {
            // กรณีเป็น String
            const leaveType = await leaveTypeRepo.findOne({
              where: [
                { leave_type_th: lr.leaveType },
                { leave_type_en: lr.leaveType }
              ]
            });
            if (leaveType) {
              leaveTypeNameTh = leaveType.leave_type_th;
              leaveTypeNameEn = leaveType.leave_type_en;
            }
          }

          // --- คำนวณระยะเวลา (เป็นภาษาไทย) ---
          let duration = '';
          if (lr.startTime && lr.endTime) {
            const startMinutes = convertToMinutes(...lr.startTime.split(':').map(Number));
            const endMinutes = convertToMinutes(...lr.endTime.split(':').map(Number));
            let durationHours = (endMinutes - startMinutes) / 60;
            if (durationHours < 0 || isNaN(durationHours)) durationHours = 0;
            duration = `${Math.floor(durationHours)} ชั่วโมง`;
          } else if (lr.startDate && lr.endDate) {
            const start = new Date(lr.startDate);
            const end = new Date(lr.endDate);
            let days = calculateDaysBetween(start, end);
            if (days < 0 || isNaN(days)) days = 0;
            duration = `${days} วัน`;
          }

          // --- จัดรูปแบบข้อความ ---
          const statusIcon = lr.status === 'approved' ? '✅' : lr.status === 'pending' ? '⏳' : '❌';
          const statusDisplay = getStatusDisplay(lr.status);
          
          const startDate = new Date(lr.startDate).toLocaleDateString('th-TH'); // วันที่แบบไทย
          const endDate = new Date(lr.endDate).toLocaleDateString('th-TH');

          // แสดงชื่อประเภทการลา (เน้นภาษาไทย)
          const leaveTypeDisplay = leaveTypeNameTh || leaveTypeNameEn;

          message += `${statusIcon} ${leaveTypeDisplay}\n`;
          message += `   📅 ${startDate} ถึง ${endDate}\n`;
          message += `   ⏱️ รวม: ${duration}\n`;
          message += `   📝 สถานะ: ${statusDisplay}\n\n`;
        }
      }
      
      return { type: 'text', text: message };
    } catch (error) {
      console.error('Error fetching recent leave:', error);
      return { type: 'text', text: '❌ เกิดข้อผิดพลาดในการดึงข้อมูล' };
    }
  }

  // Get leave balance from API and format for LINE
  static async getLeaveBalance(user) {
    try {
      // ใช้ getLeaveUsageSummary แทนการคำนวณแบบ manual
      const currentYear = new Date().getFullYear();
      const remainingLeaveData = await getLeaveUsageSummary(user.id, currentYear, global.AppDataSource);

      // Helper: Format duration display
      function formatDuration(day, hour) {
        if (day > 0 && hour > 0) {
          return `${day} days ${hour} hours`;
        } else if (day > 0) {
          return `${day} days`;
        } else if (hour > 0) {
          return `${hour} hours`;
        } else {
          return '0 days';
        }
      }

      let message = '💰 Leave Entitlements:\n\n';
      
      // Display for each leave type
      for (const leaveData of remainingLeaveData) {
        // Convert to day/hour format for display
        const quotaObj = toDayHour(leaveData.quota_days);
        const usedObj = toDayHour(leaveData.total_used_days);
        const remainingObj = toDayHour(leaveData.remaining_days);

        // Display leave type in both languages
        const leaveTypeDisplay = leaveData.leave_type_name_en && leaveData.leave_type_name_en !== leaveData.leave_type_name_th 
          ? `${leaveData.leave_type_name_th} (${leaveData.leave_type_name_en})`
          : leaveData.leave_type_name_th;

        message += `${leaveTypeDisplay}:\n`;
        message += `   📊 Total: ${formatDuration(quotaObj.day, quotaObj.hour)}\n`;
        message += `   📤 Used: ${formatDuration(usedObj.day, usedObj.hour)}\n`;
        message += `   ✅ Remaining: ${formatDuration(remainingObj.day, remainingObj.hour)}\n\n`;
      }
      
      return { type: 'text', text: message };
    } catch (error) {
      console.error('Error fetching leave entitlements:', error);
      return { type: 'text', text: '❌ Error fetching leave entitlements.' };
    }
  }

  // Get leave history from API and format for LINE
  static async getLeaveHistory(user) {
    try {
      const response = await axios.get(`${getApiBaseUrl()}/api/leave-history/${user.id}`);
      
      if (response.data.success) {
        const leaves = response.data.data;
        
        let message = '📚 Your Leave History:\n\n';
        
        if (leaves.length === 0) {
          message += 'No leave history found.';
        } else {
          leaves.slice(0, 3).forEach(leave => {
            const status = leave.status === 'approved' ? '✅' : 
                          leave.status === 'pending' ? '⏳' : '❌';
            message += `${status} ${leave.leaveType.name}\n`;
            message += `   📅 ${leave.startDate} to ${leave.endDate}\n`;
            message += `   📝 Reason: ${leave.reason}\n`;
            message += `   👤 Status: ${leave.status.toUpperCase()}\n\n`;
          });
        }
        
        return { type: 'text', text: message };
      } else {
        return { type: 'text', text: '❌ Unable to fetch leave history.' };
      }
    } catch (error) {
      console.error('API call error:', error);
      return { type: 'text', text: '❌ Error fetching leave history.' };
    }
  }

  // Get user profile from API and format for LINE
  static async getUserProfile(user) {
    try {
      const response = await axios.get(`${getApiBaseUrl()}/api/profile/${user.id}`);
      
      if (response.data.success) {
        const profile = response.data.data;
        
        let message = '👤 Your Profile:\n\n';
        message += `📛 Name: ${profile.name}\n`;
        message += `🏢 Department: ${profile.department.name}\n`;
        message += `💼 Position: ${profile.position.name}\n`;
        message += `📧 Email: ${profile.email}\n`;
        message += `📱 Phone: ${profile.phone}\n`;
        
        return { type: 'text', text: message };
      } else {
        return { type: 'text', text: '❌ Unable to fetch profile.' };
      }
    } catch (error) {
      console.error('API call error:', error);
      return { type: 'text', text: '❌ Error fetching profile.' };
    }
  }

  // Get announcements from API and format for LINE
  static async getAnnouncements() {
    try {
      const response = await axios.get(`${getApiBaseUrl()}/api/announcements`);
      
      console.log('Announcements API response:', response.data);
      
      if (response.data.status === 'success' || response.data.success) {
        const announcements = response.data.data;
        
        let message = '📢 Recent Announcements:\n\n';
        
        if (!announcements || announcements.length === 0) {
          message += 'No announcements at the moment.';
        } else {
          announcements.slice(0, 3).reverse().forEach(announcement => {
            message += `📢 ${announcement.subject}\n`;
            if (announcement.createdAt) {
              // Format date to show only YYYY-MM-DD
              const date = new Date(announcement.createdAt);
              const formattedDate = date.toISOString().split('T')[0];
              message += `   📅 ${formattedDate}\n`;
            }
            if (announcement.detail) {
              message += `   📝 ${announcement.detail.substring(0, 100)}...\n`;
            }
            message += '\n';
          });
        }
        
        return { type: 'text', text: message };
      } else {
        return { type: 'text', text: '❌ Unable to fetch recent announcements.' };
      }
    } catch (error) {
      console.error('API call error:', error);
      return { type: 'text', text: '❌ Error fetching recent announcements.' };
    }
  }

  // Static help message
  static getHelpMessage() {
    return {
      type: 'text',
      text: `🤖 SiamIT Leave Management Bot

Available Commands:

📢 announcements - Latest announcements (no login needed)
📝 request - How to submit leave request (no login needed)
❓ help - Show this message (no login needed)

🔗 Commands that need account linking:
📋 status - Check your leave status
💰 balance - Check your leave balance  
📚 history - View your leave history
👤 profile - View your profile

To link your account, go to the web application and use LINE Login!`
    };
  }

  // Instructions for submitting leave request
  static getRequestInstructions() {
    return {
      type: 'text',
      text: `📝 To submit a leave request:

1. 🌐 Go to the web application
2. 📋 Navigate to Leave Request page
3. ✏️ Fill in the required details
4. 📤 Submit your request

You'll receive LINE notifications when your request is approved/rejected!`
    };
  }

  // Send notification to specific user (for other parts of your app to use)
  static async sendNotification(userId, message) {
    try {
      console.log('=== LINE Notification Debug ===');
      console.log('Attempting to send LINE notification to:', userId);
      console.log('User ID type:', typeof userId);
      console.log('User ID length:', userId ? userId.length : 0);
      console.log('Message preview:', message.substring(0, 100) + '...');
      console.log('LINE Bot config check:');
      console.log('- Channel Access Token exists:', !!process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN);
      console.log('- Channel Secret exists:', !!process.env.LINE_BOT_CHANNEL_SECRET);
      console.log('==============================');
      
      await client.pushMessage(userId, {
        type: 'text',
        text: message
      });
      
      console.log('LINE notification sent successfully');
      return { success: true };
    } catch (error) {
      console.error('=== LINE Notification Error ===');
      console.error('Error sending LINE notification:', error);
      console.error('Error details:', {
        userId: userId,
        userIdType: typeof userId,
        messageLength: message.length,
        errorCode: error.statusCode,
        errorMessage: error.message,
        errorStack: error.stack
      });
      
      // Check if it's a permission issue
      if (error.statusCode === 403) {
        return { 
          success: false, 
          error: 'User has not added the bot as a friend or blocked the bot',
          details: error.message 
        };
      }
      
      // Check if it's a user not found issue
      if (error.statusCode === 400) {
        return { 
          success: false, 
          error: 'Invalid user ID or user not found',
          details: error.message 
        };
      }
      
      return { success: false, error: error.message };
    }
  }

  // Helper method to get user by LINE ID
  static async getUserByLineId(lineUserId) {
    try {
      const userRepo = global.AppDataSource.getRepository('User');
      return await userRepo.findOneBy({ lineUserId: lineUserId });
    } catch (error) {
      console.error('Error getting user by LINE ID:', error);
      return null;
    }
  }

  // Functions for your Rich Menu buttons
  static getLeaveWebsiteMessage() {
    return {
      type: 'text',
      text: `🌐 SiamIT Leave Management Website

To access the full leave management system:

📱 Web App: [Your Web App URL]
💻 Desktop: [Your Web App URL]

Features available on the website:
• Submit leave requests
• Upload documents
• View detailed history
• Manage profile settings
• Advanced reporting

You'll receive LINE notifications for approvals and updates!`
    };
  }

  static async getCompanyHolidays() {
    try {
      // Get company holidays directly from database like /api/custom-holidays endpoint
      const customHolidayRepo = global.AppDataSource.getRepository('CustomHoliday');
      
      // Get current year and month
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth(); // 0-11
      
      // Get holidays for current month only
      const holidays = await customHolidayRepo.find({
        where: {
          date: Between(
            new Date(currentYear, currentMonth, 1), // Start of current month
            new Date(currentYear, currentMonth + 1, 0) // End of current month
          )
        },
        order: {
          date: 'ASC'
        }
      });

      let message = '🏢 Company Holidays (Current Month):\n\n';
      
      if (!holidays || holidays.length === 0) {
        message += 'No company holidays scheduled for this month.';
      } else {
        holidays.forEach(holiday => {
          // Format date
          const date = new Date(holiday.date);
          const formattedDate = date.toLocaleDateString('en-GB', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

          // Display title in both languages if available
          let titleDisplay = holiday.title;
          if (holiday.title && holiday.title.includes('(') && holiday.title.includes(')')) {
            // Already in bilingual format
            titleDisplay = holiday.title;
          } else {
            // Try to make it bilingual (you can customize this based on your data)
            titleDisplay = holiday.title;
          }

          message += `📅 ${formattedDate}\n`;
          message += `   🏷️ ${titleDisplay}\n`;
          if (holiday.description) {
            message += `   📝 ${holiday.description}\n`;
          }
          message += '\n';
        });
      }
      
      return { type: 'text', text: message };
    } catch (error) {
      console.error('Error fetching company holidays:', error);
      return { type: 'text', text: '❌ Error fetching company holidays.' };
    }
  }

  static async getAnnualHolidays() {
    try {
      // Get current year and month
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth(); // 0-11
      
      // Thai holidays for current month (similar to getThaiHolidaysByMonth)
      const holidays = this.getThaiHolidaysForMonth(currentYear, currentMonth);
      
      let message = '📅 Annual Holidays (Current Month):\n\n';
      
      if (!holidays || holidays.length === 0) {
        message += 'No annual holidays scheduled for this month.';
      } else {
        holidays.forEach(holiday => {
          // Format date
          const date = new Date(holiday.date);
          const formattedDate = date.toLocaleDateString('en-GB', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

          // Display name in both languages
          const nameDisplay = holiday.name;

          message += `📅 ${formattedDate}\n`;
          message += `   🏷️ ${nameDisplay}\n\n`;
        });
      }
      
      return { type: 'text', text: message };
    } catch (error) {
      console.error('Error getting annual holidays:', error);
      return { type: 'text', text: '❌ Error fetching annual holidays.' };
    }
  }

  // Helper function to get Thai holidays for a specific month
  static getThaiHolidaysForMonth(year, month) {
    const holidays = [];
    
    // Define Thai holidays with bilingual names
    const thaiHolidays = [
      { date: `${year}-01-01`, name: 'วันขึ้นปีใหม่ (New Year\'s Day)' },
      { date: `${year}-01-02`, name: 'วันหยุดชดเชยวันขึ้นปีใหม่ (New Year\'s Day Holiday)' },
      { date: `${year}-02-14`, name: 'วันวาเลนไทน์ (Valentine\'s Day)' },
      { date: `${year}-04-06`, name: 'วันจักรี (Chakri Memorial Day)' },
      { date: `${year}-04-13`, name: 'วันสงกรานต์ (Songkran Festival)' },
      { date: `${year}-04-14`, name: 'วันสงกรานต์ (Songkran Festival)' },
      { date: `${year}-04-15`, name: 'วันสงกรานต์ (Songkran Festival)' },
      { date: `${year}-04-16`, name: 'วันสงกรานต์ (Songkran Festival)' },
      { date: `${year}-05-01`, name: 'วันแรงงานแห่งชาติ (Labour Day)' },
      { date: `${year}-05-05`, name: 'วันฉัตรมงคล (Coronation Day)' },
      { date: `${year}-06-03`, name: 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าสุทิดา พัชรสุธาพิมลลักษณ พระบรมราชินี (Queen Suthida\'s Birthday)' },
      { date: `${year}-07-28`, name: 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว (King\'s Birthday)' },
      { date: `${year}-08-12`, name: 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าสิริกิติ์ พระบรมราชินีนาถ พระบรมราชชนนีพันปีหลวง (The Queen Mother\'s Birthday)' },
      { date: `${year}-10-13`, name: 'วันคล้ายวันสวรรคตพระบาทสมเด็จพระบรมชนกาธิเบศร มหาภูมิพลอดุลยเดชมหาราช บรมนาถบพิตร (King Bhumibol Adulyadej Memorial Day)' },
      { date: `${year}-10-23`, name: 'วันปิยมหาราช (King Chulalongkorn Day)' },
      { date: `${year}-12-05`, name: 'วันคล้ายวันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระบรมชนกาธิเบศร มหาภูมิพลอดุลยเดชมหาราช บรมนาถบพิตร (King Bhumibol Adulyadej\'s Birthday)' },
      { date: `${year}-12-10`, name: 'วันรัฐธรรมนูญ (Constitution Day)' },
      { date: `${year}-12-25`, name: 'วันคริสต์มาส (Christmas Day)' },
      { date: `${year}-12-31`, name: 'วันสิ้นปี (New Year\'s Eve)' }
    ];
    
    // Filter holidays for the specified month
    return thaiHolidays.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      return holidayDate.getMonth() === month;
    });
  }
}

module.exports = LineController; 