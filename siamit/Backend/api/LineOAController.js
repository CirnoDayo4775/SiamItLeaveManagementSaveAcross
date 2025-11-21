const { Client } = require('@line/bot-sdk');
const axios = require('axios');

// Line Bot Configuration
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'YOUR_CHANNEL_ACCESS_TOKEN',
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'YOUR_CHANNEL_SECRET'
};

const client = new Client(lineConfig);

class LineOAController {
  // ส่งข้อความไปยัง Line OA
  static async sendMessage(userId, message) {
    try {
      const result = await client.pushMessage(userId, {
        type: 'text',
        text: message
      });
      return { success: true, result };
    } catch (error) {
      console.error('Error sending Line message:', error);
      return { success: false, error: error.message };
    }
  }

  // ส่งข้อความแจ้งเตือนการอนุมัติ Leave Request
  static async sendLeaveApprovalNotification(userId, leaveData) {
    try {
      const message = `📋 การอนุมัติคำขอลาพัก

✅ คำขอลาพักของคุณได้รับการอนุมัติแล้ว

📅 วันที่: ${leaveData.startDate} - ${leaveData.endDate}
🏷️ ประเภท: ${leaveData.leaveType}
📝 เหตุผล: ${leaveData.reason}

ขอบคุณที่ใช้บริการของเรา 🙏`;

      return await this.sendMessage(userId, message);
    } catch (error) {
      console.error('Error sending leave approval notification:', error);
      return { success: false, error: error.message };
    }
  }

  // ส่งข้อความแจ้งเตือนการปฏิเสธ Leave Request
  static async sendLeaveRejectionNotification(userId, leaveData, reason) {
    try {
      const message = `📋 การปฏิเสธคำขอลาพัก

❌ คำขอลาพักของคุณไม่ได้รับการอนุมัติ

📅 วันที่: ${leaveData.startDate} - ${leaveData.endDate}
🏷️ ประเภท: ${leaveData.leaveType}
📝 เหตุผล: ${leaveData.reason}
❌ สาเหตุการปฏิเสธ: ${reason}

หากมีข้อสงสัย กรุณาติดต่อผู้ดูแลระบบ`;

      return await this.sendMessage(userId, message);
    } catch (error) {
      console.error('Error sending leave rejection notification:', error);
      return { success: false, error: error.message };
    }
  }

  // ส่งข้อความแจ้งเตือนการสร้าง Leave Request ใหม่
  static async sendNewLeaveRequestNotification(userId, leaveData) {
    try {
      const message = `📋 คำขอลาพักใหม่

🆕 มีคำขอลาพักใหม่ที่รอการอนุมัติ

👤 พนักงาน: ${leaveData.employeeName}
📅 วันที่: ${leaveData.startDate} - ${leaveData.endDate}
🏷️ ประเภท: ${leaveData.leaveType}
📝 เหตุผล: ${leaveData.reason}

กรุณาตรวจสอบและดำเนินการ`;

      return await this.sendMessage(userId, message);
    } catch (error) {
      console.error('Error sending new leave request notification:', error);
      return { success: false, error: error.message };
    }
  }

  // ส่งข้อความแจ้งเตือนการประกาศใหม่
  static async sendAnnouncementNotification(userId, announcement) {
    try {
      const message = `📢 ประกาศใหม่

📢 หัวข้อ: ${announcement.title}
📝 เนื้อหา: ${announcement.content}
📅 วันที่: ${announcement.createdAt}

กรุณาตรวจสอบประกาศใหม่`;

      return await this.sendMessage(userId, message);
    } catch (error) {
      console.error('Error sending announcement notification:', error);
      return { success: false, error: error.message };
    }
  }

  // ตรวจสอบสถานะการเชื่อมต่อ Line OA
  static async checkConnection() {
    try {
      // ทดสอบการเชื่อมต่อโดยการดึงข้อมูล profile
      const response = await axios.get('https://api.line.me/v2/bot/profile/U0000000000000000000000000000000', {
        headers: {
          'Authorization': `Bearer ${lineConfig.channelAccessToken}`
        }
      });
      return { success: true, message: 'Line OA connected successfully' };
    } catch (error) {
      return { success: false, error: 'Line OA connection failed' };
    }
  }

  // ดึงข้อมูล Line Profile
  static async getProfile(userId) {
    try {
      const profile = await client.getProfile(userId);
      return { success: true, profile };
    } catch (error) {
      console.error('Error getting Line profile:', error);
      return { success: false, error: error.message };
    }
  }

  // ส่งข้อความแบบ Flex Message (สำหรับ UI ที่สวยงาม)
  static async sendFlexMessage(userId, flexMessage) {
    try {
      const result = await client.pushMessage(userId, {
        type: 'flex',
        altText: 'Leave Management System',
        contents: flexMessage
      });
      return { success: true, result };
    } catch (error) {
      console.error('Error sending flex message:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = LineOAController; 