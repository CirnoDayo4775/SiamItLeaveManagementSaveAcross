# คู่มือการตั้งค่า Line Official Account (Line OA)

## ภาพรวม
ระบบ Leave Management ได้รับการปรับปรุงให้สามารถส่งการแจ้งเตือนผ่าน Line Official Account ได้แล้ว โดยจะส่งการแจ้งเตือนอัตโนมัติเมื่อมีการอนุมัติ/ปฏิเสธคำขอลาพัก และการประกาศใหม่

## ฟีเจอร์ที่เพิ่มเข้ามา

### 1. การแจ้งเตือนอัตโนมัติ
- **การอนุมัติคำขอลาพัก**: ส่งข้อความแจ้งเตือนเมื่อคำขอลาพักได้รับการอนุมัติ
- **การปฏิเสธคำขอลาพัก**: ส่งข้อความแจ้งเตือนเมื่อคำขอลาพักไม่ได้รับการอนุมัติ พร้อมเหตุผล
- **คำขอลาพักใหม่**: แจ้งเตือนผู้ดูแลระบบเมื่อมีคำขอลาพักใหม่ที่รอการอนุมัติ
- **ประกาศใหม่**: แจ้งเตือนพนักงานเมื่อมีการประกาศใหม่

### 2. การจัดการ Line OA
- ตรวจสอบสถานะการเชื่อมต่อ Line OA
- ทดสอบการส่งข้อความ
- จัดการการตั้งค่า Channel Access Token และ Channel Secret

## ขั้นตอนการตั้งค่า

### 1. สร้าง Line Official Account

1. ไปที่ [Line Developers Console](https://developers.line.biz/)
2. สร้าง Provider ใหม่ (หากยังไม่มี)
3. สร้าง Channel ใหม่ โดยเลือกประเภท **Messaging API**
4. ตั้งชื่อ Channel และอัปโหลดรูปโปรไฟล์

### 2. ตั้งค่า Channel

1. ไปที่ Channel Settings
2. คัดลอก **Channel Access Token** และ **Channel Secret**
3. ตั้งค่า **Webhook URL**: `https://your-domain.com/api/line/webhook`
4. เปิดใช้งาน **Use webhook**

### 3. ตั้งค่า Environment Variables

สร้างไฟล์ `.env` ในโฟลเดอร์ `Backend/` และเพิ่มข้อมูลต่อไปนี้:

```env
# Line Official Account Configuration
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
LINE_CHANNEL_SECRET=your_channel_secret_here
```

### 4. ติดตั้ง Dependencies

```bash
cd Backend
npm install @line/bot-sdk axios dotenv
```

### 5. รีสตาร์ท Server

```bash
# Backend
cd Backend
npm start

# Frontend
npm run dev
```

## การใช้งาน

### 1. เข้าถึงการตั้งค่า Line OA

1. เข้าสู่ระบบด้วยบัญชี Admin
2. ไปที่เมนู "ตั้งค่า Line OA" ในแถบด้านข้าง
3. ตรวจสอบสถานะการเชื่อมต่อ

### 2. ทดสอบการส่งข้อความ

1. กรอก Line User ID ที่ต้องการส่งข้อความ
2. ใส่ข้อความทดสอบ
3. กดปุ่ม "ส่งข้อความทดสอบ"

### 3. การแจ้งเตือนอัตโนมัติ

ระบบจะส่งการแจ้งเตือนอัตโนมัติในกรณีต่อไปนี้:

- **เมื่ออนุมัติคำขอลาพัก**: พนักงานจะได้รับข้อความแจ้งเตือนการอนุมัติ
- **เมื่อปฏิเสธคำขอลาพัก**: พนักงานจะได้รับข้อความแจ้งเตือนการปฏิเสธพร้อมเหตุผล
- **เมื่อมีคำขอลาพักใหม่**: ผู้ดูแลระบบจะได้รับข้อความแจ้งเตือน
- **เมื่อมีการประกาศใหม่**: พนักงานจะได้รับข้อความแจ้งเตือน

## API Endpoints

### Line OA API

- `POST /api/line/send-message` - ส่งข้อความทั่วไป
- `POST /api/line/send-leave-approval` - ส่งการแจ้งเตือนการอนุมัติ
- `POST /api/line/send-leave-rejection` - ส่งการแจ้งเตือนการปฏิเสธ
- `POST /api/line/send-new-leave-request` - ส่งการแจ้งเตือนคำขอลาพักใหม่
- `POST /api/line/send-announcement` - ส่งการแจ้งเตือนประกาศใหม่
- `GET /api/line/check-connection` - ตรวจสอบการเชื่อมต่อ
- `GET /api/line/profile/:userId` - ดึงข้อมูล Line Profile
- `POST /api/line/webhook` - Webhook endpoint สำหรับรับข้อความจาก Line

## การแก้ไขปัญหา

### 1. ไม่สามารถเชื่อมต่อ Line OA ได้

- ตรวจสอบ Channel Access Token และ Channel Secret
- ตรวจสอบว่า Webhook URL ถูกต้อง
- ตรวจสอบว่า Server สามารถเข้าถึงได้จากภายนอก

### 2. ไม่ได้รับข้อความแจ้งเตือน

- ตรวจสอบว่า Line User ID ถูกต้อง
- ตรวจสอบว่า User ได้ Add Line OA เป็นเพื่อนแล้ว
- ตรวจสอบ Log ใน Backend

### 3. Webhook ไม่ทำงาน

- ตรวจสอบ URL ของ Webhook
- ตรวจสอบว่า Server สามารถรับ HTTPS requests ได้
- ตรวจสอบ Firewall และ Network settings

## หมายเหตุสำคัญ

1. **Security**: อย่าเปิดเผย Channel Access Token และ Channel Secret
2. **Rate Limiting**: Line API มีการจำกัดจำนวนข้อความที่ส่งได้
3. **User Consent**: ผู้ใช้ต้อง Add Line OA เป็นเพื่อนก่อนจึงจะได้รับข้อความ
4. **Testing**: ใช้ Test User ID สำหรับการทดสอบ

## การพัฒนาต่อ

- เพิ่มการส่ง Flex Messages สำหรับ UI ที่สวยงาม
- เพิ่มการจัดการ Line User ในระบบ
- เพิ่มการตั้งค่าการแจ้งเตือนแบบละเอียด
- เพิ่มการส่งไฟล์แนบผ่าน Line OA 