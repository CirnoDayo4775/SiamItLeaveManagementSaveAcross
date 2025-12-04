const line = require('@line/bot-sdk');
const { Between, In } = require('typeorm');
require('dotenv').config();

const { 
  toDayHour, 
  calculateDaysBetween, 
  convertToMinutes,
  getLeaveUsageSummary
} = require('../utils');

// --- Configuration ---
const config = {
  channelAccessToken: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_BOT_CHANNEL_SECRET
};

const client = new line.Client(config);

// --- Helper Functions ---

/**
 * Format Date to Thai String (e.g., 14 มกราคม 2567)
 */
const formatThaiDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
};

/**
 * Format Date to Thai String Short (e.g., 14/01/2567)
 */
const formatThaiDateShort = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('th-TH');
};

/**
 * Helper to resolve leave type name from ID or String
 */
const resolveLeaveTypeName = async (identifier) => {
  if (!identifier) return 'ไม่ระบุ';
  
  // If it looks like a UUID (> 20 chars), try to fetch from DB
  if (identifier.length > 20) {
    try {
      const repo = global.AppDataSource.getRepository('LeaveType');
      // Fetch including soft-deleted
      const type = await repo.findOne({ where: { id: identifier }, withDeleted: true });
      if (type) {
        const prefix = (type.is_active === false || type.deleted_at) ? '[ลบ] ' : '';
        return prefix + (type.leave_type_th || type.leave_type_en || identifier);
      }
      
      // Fallback: Try raw query if TypeORM fails
      const [raw] = await global.AppDataSource.query(`SELECT leave_type_th, leave_type_en FROM leave_type WHERE id = ?`, [identifier]);
      if (raw) return raw.leave_type_th || raw.leave_type_en;

    } catch (e) { /* Ignore error, fallback to identifier */ }
  }
  
  return identifier; // Return original string if not UUID or not found
};

class LineController {
  
  // Webhook endpoint
  static async webhook(req, res) {
    try {
      const events = req.body.events;
      await Promise.all(events.map(event => this.handleEvent(event)));
      res.json({ success: true });
    } catch (err) {
      console.error('LINE webhook error:', err);
      res.status(500).json({ error: err.message });
    }
  }

  // Event Router
  static async handleEvent(event) {
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

  // Follow Event Handler
  static async handleFollow(event) {
    const replyToken = event.replyToken;
    const welcomeMessage = {
      type: 'text',
      text: `🎉 ยินดีต้อนรับสู่ SiamIT Leave Management Bot!

ฉันพร้อมช่วยคุณจัดการการลาและตรวจสอบข้อมูลต่างๆ
คุณสามารถพิมพ์ "help" เพื่อดูคำสั่งที่ใช้งานได้

เพื่อการใช้งานที่ครบถ้วน กรุณาเชื่อมต่อบัญชีของคุณผ่านเว็บไซต์โดยใช้ฟีเจอร์ LINE Login`
    };
    return client.replyMessage(replyToken, welcomeMessage);
  }

  // Text Message Logic
  static async handleTextMessage(event) {
    const text = event.message.text.trim();
    const userId = event.source.userId;
    const replyToken = event.replyToken;

    try {
      const response = await this.processUserMessage(text, userId);
      if (response) {
        await client.replyMessage(replyToken, response);
      }
    } catch (error) {
      console.error('Error processing LINE message:', error);
      await client.replyMessage(replyToken, { type: 'text', text: '❌ ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
    }
  }

  // Command Processor
  static async processUserMessage(message, lineUserId) {
    const command = message.toLowerCase();
    
    // Commands available without linking account
    const publicCommands = [
      'help', 'announcements', 'request', 'recent announcements', 
      'leave management web site', 'company holidays', 'annual holidays'
    ];

    let user = null;

    // Check user linkage if command requires it
    if (!publicCommands.includes(command)) {
      const userRepo = global.AppDataSource.getRepository('User');
      user = await userRepo.findOneBy({ lineUserId: lineUserId });

      if (!user) {
        return {
          type: 'text',
          text: `🔗 กรุณาเชื่อมต่อบัญชี LINE ของคุณก่อนใช้งาน!\n\nคุณสามารถเชื่อมต่อบัญชีได้ที่หน้าเว็บไซต์ผ่านฟีเจอร์ LINE Login\n\nคำสั่งที่ใช้งานได้โดยไม่ต้องเชื่อมต่อบัญชี:\n- help (ช่วยเหลือ)\n- announcements (ประกาศ)\n- request (วิธีลา)\n- company holidays (วันหยุดบริษัท)`
        };
      }
    }

    // Command Switch
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
        // Optional: Return help only if it looks like a command, otherwise ignore chat
        return this.getHelpMessage(); 
    }
  }

  // --- Feature Handlers ---

  static async getLeaveStatus(user) {
    try {
      const leaveRepo = global.AppDataSource.getRepository('LeaveRequest');
      
      // Fetch latest 3 leaves
      const leaveRequests = await leaveRepo.find({ 
        where: { Repid: user.id }, 
        order: { createdAt: 'DESC' }, 
        take: 3 
      });

      if (leaveRequests.length === 0) {
        return { type: 'text', text: `📋 รายการลาล่าสุด: ${user.name || 'คุณ'}\n\nไม่พบประวัติการลาล่าสุด` };
      }

      let message = `📋 รายการลาล่าสุด: ${user.name || 'คุณ'}\n\n`;

      for (const lr of leaveRequests) {
        // Resolve Name
        const leaveTypeName = await resolveLeaveTypeName(lr.leaveType);
        
        // Calculate Duration
        let duration = '';
        if (lr.startTime && lr.endTime) {
          const startM = convertToMinutes(...lr.startTime.split(':').map(Number));
          const endM = convertToMinutes(...lr.endTime.split(':').map(Number));
          const hours = Math.max(0, (endM - startM) / 60);
          duration = `${Math.floor(hours)} ชั่วโมง`;
        } else if (lr.startDate && lr.endDate) {
          const days = calculateDaysBetween(new Date(lr.startDate), new Date(lr.endDate));
          duration = `${days} วัน`;
        }

        // Status Display
        const statusMap = {
          approved: { icon: '✅', text: 'อนุมัติ' },
          pending: { icon: '⏳', text: 'รออนุมัติ' },
          rejected: { icon: '❌', text: 'ไม่อนุมัติ' }
        };
        const st = statusMap[lr.status] || { icon: '❓', text: lr.status };

        message += `${st.icon} ${leaveTypeName}\n`;
        message += `   📅 ${formatThaiDateShort(lr.startDate)} - ${formatThaiDateShort(lr.endDate)}\n`;
        message += `   ⏱️ รวม: ${duration}\n`;
        message += `   📝 สถานะ: ${st.text}\n\n`;
      }

      return { type: 'text', text: message };
    } catch (error) {
      console.error('Error in getLeaveStatus:', error);
      return { type: 'text', text: '❌ เกิดข้อผิดพลาดในการดึงข้อมูล' };
    }
  }

  static async getLeaveBalance(user) {
    try {
      const currentYear = new Date().getFullYear();
      const summary = await getLeaveUsageSummary(user.id, currentYear, global.AppDataSource);

      if (!summary || summary.length === 0) {
        return { type: 'text', text: '💰 สิทธิ์วันลาของคุณ:\n\nไม่พบข้อมูลสิทธิ์วันลา' };
      }

      let message = '💰 สิทธิ์วันลาของคุณ:\n\n';
      
      const formatDur = (d, h) => {
        if (d > 0 && h > 0) return `${d} วัน ${h} ชั่วโมง`;
        if (d > 0) return `${d} วัน`;
        if (h > 0) return `${h} ชั่วโมง`;
        return '0 วัน';
      };

      for (const item of summary) {
        const typeName = item.leave_type_name_th || item.leave_type_name_en || 'ไม่ระบุ';
        const quota = toDayHour(item.quota_days);
        const used = toDayHour(item.total_used_days);
        const remaining = toDayHour(item.remaining_days);

        message += `📌 ${typeName}:\n`;
        message += `   📊 ทั้งหมด: ${formatDur(quota.day, quota.hour)}\n`;
        message += `   📤 ใช้ไป: ${formatDur(used.day, used.hour)}\n`;
        message += `   ✅ คงเหลือ: ${formatDur(remaining.day, remaining.hour)}\n\n`;
      }

      return { type: 'text', text: message };
    } catch (error) {
      console.error('Error in getLeaveBalance:', error);
      return { type: 'text', text: '❌ เกิดข้อผิดพลาดในการดึงข้อมูลสิทธิ์วันลา' };
    }
  }

  static async getLeaveHistory(user) {
    try {
      // Query DB Directly instead of Axios
      const leaveRepo = global.AppDataSource.getRepository('LeaveRequest');
      const leaves = await leaveRepo.find({
        where: { Repid: user.id },
        order: { createdAt: 'DESC' },
        take: 5 // Limit to 5 for readability in chat
      });

      if (leaves.length === 0) {
        return { type: 'text', text: '📚 ประวัติการลาของคุณ:\n\nไม่พบประวัติการลา' };
      }

      let message = '📚 ประวัติการลาของคุณ (5 รายการล่าสุด):\n\n';

      for (const leave of leaves) {
        const typeName = await resolveLeaveTypeName(leave.leaveType);
        
        let statusText = leave.status;
        let icon = '❓';
        if (leave.status === 'approved') { statusText = 'อนุมัติ'; icon = '✅'; }
        else if (leave.status === 'pending') { statusText = 'รออนุมัติ'; icon = '⏳'; }
        else if (leave.status === 'rejected') { statusText = 'ไม่อนุมัติ'; icon = '❌'; }

        message += `${icon} ${typeName}\n`;
        message += `   📅 ${formatThaiDateShort(leave.startDate)} - ${formatThaiDateShort(leave.endDate)}\n`;
        if (leave.reason) message += `   📝 เหตุผล: ${leave.reason}\n`;
        message += `   👤 สถานะ: ${statusText}\n\n`;
      }

      return { type: 'text', text: message };
    } catch (error) {
      console.error('Error in getLeaveHistory:', error);
      return { type: 'text', text: '❌ เกิดข้อผิดพลาดในการดึงประวัติ' };
    }
  }

  static async getUserProfile(user) {
    try {
      // User entity is already fetched, just need relations if missing
      const userRepo = global.AppDataSource.getRepository('User');
      const profile = await userRepo.findOne({
        where: { id: user.id },
        relations: [] // Add relations if Department/Position are relations, otherwise manually fetch
      });

      // Manual fetch for Dept/Pos names if they are IDs
      let deptName = profile.department || '-';
      let posName = profile.position || '-';

      if (profile.department) {
        const dept = await global.AppDataSource.getRepository('Department').findOneBy({ id: profile.department });
        if (dept) deptName = dept.department_name_th || dept.department_name_en;
      }
      if (profile.position) {
        const pos = await global.AppDataSource.getRepository('Position').findOneBy({ id: profile.position });
        if (pos) posName = pos.position_name_th || pos.position_name_en;
      }

      let message = '👤 ข้อมูลส่วนตัว:\n\n';
      message += `📛 ชื่อ: ${profile.name || '-'}\n`;
      message += `🏢 แผนก: ${deptName}\n`;
      message += `💼 ตำแหน่ง: ${posName}\n`;
      message += `📧 อีเมล: ${profile.Email || '-'}\n`;
      message += `📱 เบอร์โทร: ${profile.phone_number || '-'}\n`;

      return { type: 'text', text: message };
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      return { type: 'text', text: '❌ ไม่สามารถดึงข้อมูลโปรไฟล์ได้' };
    }
  }

  static async getAnnouncements() {
    try {
      const announcementRepo = global.AppDataSource.getRepository('Announcements');
      const announcements = await announcementRepo.find({
        order: { createdAt: 'DESC' },
        take: 3
      });

      if (announcements.length === 0) {
        return { type: 'text', text: '📢 ประกาศล่าสุด:\n\nไม่มีประกาศในขณะนี้' };
      }

      let message = '📢 ประกาศล่าสุด:\n\n';
      announcements.forEach(ann => {
        message += `📢 ${ann.subject}\n`;
        if (ann.createdAt) message += `   📅 ${formatThaiDateShort(ann.createdAt)}\n`;
        if (ann.detail) message += `   📝 ${ann.detail.substring(0, 100)}${ann.detail.length > 100 ? '...' : ''}\n`;
        message += '\n';
      });

      return { type: 'text', text: message };
    } catch (error) {
      console.error('Error in getAnnouncements:', error);
      return { type: 'text', text: '❌ เกิดข้อผิดพลาดในการดึงประกาศ' };
    }
  }

  static async getCompanyHolidays() {
    try {
      const customHolidayRepo = global.AppDataSource.getRepository('CustomHoliday');
      const now = new Date();
      
      const holidays = await customHolidayRepo.find({
        where: {
          date: Between(
            new Date(now.getFullYear(), now.getMonth(), 1),
            new Date(now.getFullYear(), now.getMonth() + 1, 0)
          )
        },
        order: { date: 'ASC' }
      });

      if (holidays.length === 0) {
        return { type: 'text', text: '🏢 วันหยุดบริษัท (เดือนนี้):\n\nไม่มีวันหยุดบริษัทในเดือนนี้' };
      }

      let message = '🏢 วันหยุดบริษัท (เดือนนี้):\n\n';
      holidays.forEach(h => {
        message += `📅 ${formatThaiDate(h.date)}\n`;
        message += `   🏷️ ${h.title}\n`;
        if (h.description) message += `   📝 ${h.description}\n`;
        message += '\n';
      });

      return { type: 'text', text: message };
    } catch (error) {
      console.error('Error in getCompanyHolidays:', error);
      return { type: 'text', text: '❌ เกิดข้อผิดพลาดในการดึงข้อมูลวันหยุด' };
    }
  }

  // --- Static Messages & Utility ---

  static getHelpMessage() {
    return {
      type: 'text',
      text: `🤖 SiamIT Leave Management Bot

คำสั่งที่ใช้งานได้:
📢 announcements - ดูประกาศล่าสุด
📝 request - วิธีการส่งคำขอลา
🏢 company holidays - วันหยุดบริษัท
❓ help - แสดงข้อความช่วยเหลือนี้

🔗 คำสั่งที่ต้องเชื่อมต่อบัญชี:
📋 status - ตรวจสอบสถานะการลาล่าสุด
💰 balance - ตรวจสอบวันลาคงเหลือ
📚 history - ดูประวัติการลา
👤 profile - ดูข้อมูลส่วนตัว`
    };
  }

  static getRequestInstructions() {
    return {
      type: 'text',
      text: `📝 วิธีการส่งคำขอลา:

1. 🌐 ไปที่เว็บไซต์แอปพลิเคชัน
2. 📋 ไปที่เมนู "แจ้งลา" (Leave Request)
3. ✏️ กรอกรายละเอียดที่จำเป็นให้ครบถ้วน
4. 📤 กดส่งคำขอ

คุณจะได้รับการแจ้งเตือนผ่าน LINE เมื่อคำขอของคุณได้รับการอนุมัติ!`
    };
  }

  static getLeaveWebsiteMessage() {
    return {
      type: 'text',
      text: `🌐 เว็บไซต์จัดการการลา SiamIT

เข้าสู่ระบบได้ที่: ${process.env.FRONTEND_URL || '[Please Set FRONTEND_URL]'}

ฟีเจอร์บนเว็บไซต์:
• ส่งคำขอลาหยุด & อัปโหลดเอกสาร
• ดูประวัติและสิทธิ์วันลา
• รายงานสรุปต่างๆ`
    };
  }

  static async getAnnualHolidays() {
    const now = new Date();
    const holidays = this.getThaiHolidaysForMonth(now.getFullYear(), now.getMonth());
    
    if (holidays.length === 0) return { type: 'text', text: '📅 วันหยุดประจำปี (เดือนนี้):\n\nไม่มีวันหยุดประจำปีในเดือนนี้' };

    let message = '📅 วันหยุดประจำปี (เดือนนี้):\n\n';
    holidays.forEach(h => {
      message += `📅 ${formatThaiDate(h.date)}\n   🏷️ ${h.name}\n\n`;
    });
    return { type: 'text', text: message };
  }

  static getThaiHolidaysForMonth(year, month) {
    const allHolidays = [
      { date: `${year}-01-01`, name: "วันขึ้นปีใหม่" },
      { date: `${year}-02-14`, name: "วันวาเลนไทน์" },
      { date: `${year}-04-06`, name: "วันจักรี" },
      { date: `${year}-04-13`, name: "วันสงกรานต์" },
      { date: `${year}-04-14`, name: "วันสงกรานต์" },
      { date: `${year}-04-15`, name: "วันสงกรานต์" },
      { date: `${year}-05-01`, name: "วันแรงงานแห่งชาติ" },
      { date: `${year}-05-05`, name: "วันฉัตรมงคล" },
      { date: `${year}-06-03`, name: "วันเฉลิมพระชนมพรรษาพระราชินี" },
      { date: `${year}-07-28`, name: "วันเฉลิมพระชนมพรรษา R10" },
      { date: `${year}-08-12`, name: "วันแม่แห่งชาติ" },
      { date: `${year}-10-13`, name: "วันคล้ายวันสวรรคต R9" },
      { date: `${year}-10-23`, name: "วันปิยมหาราช" },
      { date: `${year}-12-05`, name: "วันพ่อแห่งชาติ" },
      { date: `${year}-12-10`, name: "วันรัฐธรรมนูญ" },
      { date: `${year}-12-31`, name: "วันสิ้นปี" }
    ];

    return allHolidays.filter(h => {
      const d = new Date(h.date);
      return d.getMonth() === month;
    });
  }

  // Send Push Notification (Called by other controllers)
  static async sendNotification(lineUserId, message) {
    if (!lineUserId) return { success: false, error: 'No Line User ID provided' };
    try {
      await client.pushMessage(lineUserId, { type: 'text', text: message });
      return { success: true };
    } catch (error) {
      console.error(`LINE Push Error (${lineUserId}):`, error.originalError?.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = LineController;