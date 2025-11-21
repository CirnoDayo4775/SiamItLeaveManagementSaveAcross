# คู่มือการสร้าง Rich Menu สำหรับ Line OA

## 🌐 การสร้าง URL สำหรับ Rich Menu

### 1. URL สำหรับการพัฒนา (Development)

**สำหรับการทดสอบในเครื่อง:**
```
http://localhost:8081
```

**สำหรับการทดสอบผ่าน ngrok:**
```
https://your-ngrok-url.ngrok.io
```

### 2. URL สำหรับ Production

**เมื่อ Deploy ไปยัง Server:**
```
https://your-domain.com
https://your-app.vercel.app
https://your-app.netlify.app
```

## 📱 การสร้าง Rich Menu

### ขั้นตอนที่ 1: เข้าสู่ระบบ Admin

1. เข้าสู่ระบบด้วยบัญชี Admin
2. ไปที่เมนู "ตั้งค่า Line OA"
3. ตรวจสอบสถานะการเชื่อมต่อ Line OA

### ขั้นตอนที่ 2: ตั้งค่า Base URL

1. ในส่วน "จัดการ Rich Menu"
2. ใส่ Base URL ของเว็บไซต์:
   - **Development**: `http://localhost:8081`
   - **Production**: `https://your-domain.com`

### ขั้นตอนที่ 3: สร้าง Rich Menu

**ตัวเลือกที่ 1: Rich Menu แบบ 3x2 Grid**
- คลิกปุ่ม "สร้าง Rich Menu (3x2 Grid)"
- จะสร้างเมนูที่มี 6 ปุ่ม:
  - ขอลาพัก
  - ประวัติการลา
  - โปรไฟล์
  - ประกาศ
  - การแจ้งเตือน
  - ตั้งค่า

**ตัวเลือกที่ 2: Rich Menu แบบ Simple**
- คลิกปุ่ม "สร้าง Rich Menu (Simple)"
- จะสร้างเมนูที่มี 2 ปุ่ม:
  - ขอลาพัก
  - ประวัติการลา

### ขั้นตอนที่ 4: ตั้งค่า Rich Menu เป็น Default

1. หลังจากสร้าง Rich Menu สำเร็จ
2. คลิกปุ่ม "ตั้งเป็น Default" ในรายการ Rich Menu
3. Rich Menu จะแสดงในแอป Line

## 🎨 โครงสร้าง Rich Menu

### Rich Menu แบบ 3x2 Grid

```
┌─────────────┬─────────────┬─────────────┐
│   ขอลาพัก   │ ประวัติการลา │   โปรไฟล์   │
├─────────────┼─────────────┼─────────────┤
│   ประกาศ     │การแจ้งเตือน │   ตั้งค่า   │
└─────────────┴─────────────┴─────────────┘
```

### Rich Menu แบบ Simple

```
┌─────────────────────────────────────────┐
│              ขอลาพัก                    │
├─────────────────────────────────────────┤
│            ประวัติการลา                 │
└─────────────────────────────────────────┘
```

## 🔗 URL ที่ใช้ใน Rich Menu

### สำหรับ Development
```javascript
// Base URL
const baseUrl = "http://localhost:8081";

// URLs ที่ใช้ใน Rich Menu
const urls = {
  leaveRequest: `${baseUrl}/leave-request`,
  leaveHistory: `${baseUrl}/leave-history`,
  profile: `${baseUrl}/profile`,
  announcements: `${baseUrl}/announcements`,
  notifications: `${baseUrl}/notifications`,
  settings: `${baseUrl}/settings`
};
```

### สำหรับ Production
```javascript
// Base URL
const baseUrl = "https://your-domain.com";

// URLs ที่ใช้ใน Rich Menu
const urls = {
  leaveRequest: `${baseUrl}/leave-request`,
  leaveHistory: `${baseUrl}/leave-history`,
  profile: `${baseUrl}/profile`,
  announcements: `${baseUrl}/announcements`,
  notifications: `${baseUrl}/notifications`,
  settings: `${baseUrl}/settings`
};
```

## 📋 API Endpoints สำหรับ Rich Menu

### สร้าง Rich Menu
```bash
# สร้าง Rich Menu แบบ Grid
POST /api/line/rich-menu/create
{
  "baseUrl": "https://your-domain.com"
}

# สร้าง Rich Menu แบบ Simple
POST /api/line/rich-menu/simple
{
  "baseUrl": "https://your-domain.com"
}
```

### จัดการ Rich Menu
```bash
# ดึงรายการ Rich Menu
GET /api/line/rich-menu/list

# ตั้งค่า Rich Menu เป็น default
POST /api/line/rich-menu/set-default/:richMenuId

# ลบ Rich Menu
DELETE /api/line/rich-menu/:richMenuId
```

## 🎯 การใช้งาน Rich Menu

### 1. ผู้ใช้กดปุ่มใน Rich Menu
2. ระบบจะเปิดเว็บไซต์ในเบราว์เซอร์
3. ผู้ใช้สามารถใช้งานฟีเจอร์ต่างๆ ได้

### ตัวอย่างการใช้งาน:

**เมื่อกดปุ่ม "ขอลาพัก":**
- เปิดหน้า `/leave-request`
- ผู้ใช้สามารถส่งคำขอลาพักใหม่ได้

**เมื่อกดปุ่ม "ประวัติการลา":**
- เปิดหน้า `/leave-history`
- ผู้ใช้สามารถดูประวัติการลาทั้งหมดได้

**เมื่อกดปุ่ม "ประกาศ":**
- เปิดหน้า `/announcements`
- ผู้ใช้สามารถดูประกาศล่าสุดได้

## 🔧 การแก้ไขปัญหา

### ปัญหาที่พบบ่อย:

**1. Rich Menu ไม่แสดง**
- ตรวจสอบว่าได้ตั้งค่าเป็น Default แล้ว
- ตรวจสอบว่า Line OA เชื่อมต่อแล้ว

**2. URL ไม่ทำงาน**
- ตรวจสอบ Base URL ถูกต้อง
- ตรวจสอบว่าเว็บไซต์สามารถเข้าถึงได้

**3. ไม่สามารถสร้าง Rich Menu ได้**
- ตรวจสอบ Channel Access Token
- ตรวจสอบการเชื่อมต่อ Line OA

## 📱 การทดสอบ Rich Menu

### 1. ทดสอบใน Development
```bash
# ใช้ ngrok เพื่อสร้าง Public URL
npx ngrok http 8081

# ใช้ URL ที่ได้จาก ngrok
https://abc123.ngrok.io
```

### 2. ทดสอบใน Production
```bash
# ใช้ Domain จริง
https://your-domain.com
```

## 🚀 การ Deploy

### 1. Deploy ไปยัง Vercel
```bash
# ติดตั้ง Vercel CLI
npm i -g vercel

# Deploy
vercel

# ใช้ URL ที่ได้จาก Vercel
https://your-app.vercel.app
```

### 2. Deploy ไปยัง Netlify
```bash
# Build project
npm run build

# Deploy ไปยัง Netlify
# ใช้ URL ที่ได้จาก Netlify
https://your-app.netlify.app
```

### 3. Deploy ไปยัง Server
```bash
# ใช้ Domain ของคุณ
https://your-domain.com
```

## 📝 หมายเหตุสำคัญ

1. **HTTPS**: Line OA ต้องการ HTTPS URL สำหรับ Production
2. **Domain**: ต้องใช้ Domain ที่ถูกต้อง ไม่ใช่ IP Address
3. **CORS**: ต้องตั้งค่า CORS ให้ถูกต้อง
4. **Authentication**: ต้องจัดการ Authentication สำหรับ Production

## 🎨 การปรับแต่ง Rich Menu

### เพิ่มปุ่มใหม่:
1. แก้ไขไฟล์ `LineRichMenuController.js`
2. เพิ่ม area ใหม่ใน richMenu object
3. ตั้งค่า bounds และ action
4. สร้าง Rich Menu ใหม่

### เปลี่ยนรูปภาพ:
1. สร้างรูปภาพขนาด 2500x843 px
2. อัปโหลดรูปภาพผ่าน Line Developers Console
3. ตั้งค่าเป็น Rich Menu Image

## 📞 การติดต่อ

หากมีปัญหาหรือต้องการความช่วยเหลือ:
- ตรวจสอบ Log ใน Backend
- ตรวจสอบการตั้งค่า Line OA
- ตรวจสอบ URL และ Domain 