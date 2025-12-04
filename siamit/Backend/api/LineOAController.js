const { Client } = require('@line/bot-sdk');
require('dotenv').config();

// Line Bot Configuration
const lineConfig = {
  // แก้ไข: ต้องใช้ Access Token ไม่ใช่ Secret ซ้ำ
  channelAccessToken: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_BOT_CHANNEL_SECRET
};

const client = new Client(lineConfig);

class LineOAController {
  
  /**
   * Helper: Centralized Error Handler
   */
  static _handleError(context, error) {
    console.error(`LineOA Error [${context}]:`, error.message);
    return { success: false, error: error.message };
  }

  /**
   * Helper: Validate User ID
   */
  static _validateUser(userId) {
    if (!userId) throw new Error('User ID is required');
  }

  // ส่งข้อความ Text ทั่วไป
  static async sendMessage(userId, message) {
    try {
      this._validateUser(userId);
      const result = await client.pushMessage(userId, {
        type: 'text',
        text: message
      });
      return { success: true, result };
    } catch (error) {
      return this._handleError('sendMessage', error);
    }
  }

  // ส่งข้อความแจ้งเตือนการอนุมัติ Leave Request
  static async sendLeaveApprovalNotification(userId, leaveData) {
    const message = `📋 การอนุมัติคำขอลาพัก
    
✅ คำขอลาพักของคุณได้รับการอนุมัติแล้ว

📅 วันที่: ${leaveData.startDate} - ${leaveData.endDate}
🏷️ ประเภท: ${leaveData.leaveType}
📝 เหตุผล: ${leaveData.reason}

ขอบคุณที่ใช้บริการของเรา 🙏`;

    return this.sendMessage(userId, message);
  }

  // ส่งข้อความแจ้งเตือนการปฏิเสธ Leave Request
  static async sendLeaveRejectionNotification(userId, leaveData, reason) {
    const message = `📋 การปฏิเสธคำขอลาพัก

❌ คำขอลาพักของคุณไม่ได้รับการอนุมัติ

📅 วันที่: ${leaveData.startDate} - ${leaveData.endDate}
🏷️ ประเภท: ${leaveData.leaveType}
📝 เหตุผล: ${leaveData.reason}
❌ สาเหตุ: ${reason || 'ไม่ระบุ'}

หากมีข้อสงสัย กรุณาติดต่อผู้ดูแลระบบ`;

    return this.sendMessage(userId, message);
  }

  // ส่งข้อความแจ้งเตือนการสร้าง Leave Request ใหม่
  static async sendNewLeaveRequestNotification(userId, leaveData) {
    const message = `📋 คำขอลาพักใหม่

🆕 มีคำขอลาพักใหม่ที่รอการอนุมัติ

👤 พนักงาน: ${leaveData.employeeName}
📅 วันที่: ${leaveData.startDate} - ${leaveData.endDate}
🏷️ ประเภท: ${leaveData.leaveType}
📝 เหตุผล: ${leaveData.reason}

กรุณาตรวจสอบและดำเนินการ`;

    return this.sendMessage(userId, message);
  }

  // ส่งข้อความแจ้งเตือนการประกาศใหม่
  static async sendAnnouncementNotification(userId, announcement) {
    const message = `📢 ประกาศใหม่

📌 หัวข้อ: ${announcement.title}
📝 เนื้อหา: ${announcement.content}
📅 วันที่: ${announcement.createdAt}

กรุณาตรวจสอบประกาศใหม่`;

    return this.sendMessage(userId, message);
  }

  // ตรวจสอบสถานะการเชื่อมต่อ Line OA (ใช้ getBotInfo แทน axios)
  static async checkConnection() {
    try {
      // ตรวจสอบว่า Token ใช้งานได้จริงโดยการดึงข้อมูลบอท
      const botInfo = await client.getBotInfo();
      return { 
        success: true, 
        message: 'Line OA connected successfully',
        botName: botInfo.displayName 
      };
    } catch (error) {
      return this._handleError('checkConnection', error);
    }
  }

  // ดึงข้อมูล Line Profile
  static async getProfile(userId) {
    try {
      this._validateUser(userId);
      const profile = await client.getProfile(userId);
      return { success: true, profile };
    } catch (error) {
      return this._handleError('getProfile', error);
    }
  }

  // ส่งข้อความแบบ Flex Message
  static async sendFlexMessage(userId, flexMessage) {
    try {
      this._validateUser(userId);
      
      // ตรวจสอบโครงสร้างพื้นฐานของ Flex Message
      const messageContainer = {
        type: 'flex',
        altText: flexMessage.altText || 'Leave Management Notification',
        contents: flexMessage.contents || flexMessage // รองรับทั้งส่งมาแค่ content หรือ object เต็ม
      };

      const result = await client.pushMessage(userId, messageContainer);
      return { success: true, result };
    } catch (error) {
      return this._handleError('sendFlexMessage', error);
    }
  }
}

module.exports = LineOAController;