const swaggerAutogen = require('swagger-autogen')();
const fs = require('fs');
const path = require('path');

const outputFile = './swagger_output.json';
const tempRoutesFile = './routes-static-generated.js'; // ไฟล์ชั่วคราวที่เราจะสร้าง

// --- 1. สร้างไฟล์ Route จำลองแบบ Static (เพื่อให้ Swagger อ่านออก) ---
const apiDir = './api';
let apiFiles = [];

try {
    apiFiles = fs.readdirSync(apiDir).filter(file => file.endsWith('.js'));
} catch (e) {
    console.error('❌ Cannot read api directory');
    process.exit(1);
}

// สร้างเนื้อหาไฟล์ JS โดยเขียนบรรทัด require ทีละไฟล์แบบชัดเจน (ไม่ใช้ loop)
let fileContent = `
const express = require('express');
const app = express();

// Mock Database (สร้างของปลอมเพื่อให้ Controller ไม่พังตอนถูกเรียกอ่าน)
const mockDB = {
    getRepository: () => ({
        find: () => [], findOne: () => {}, findOneBy: () => {}, save: () => {}, 
        create: () => {}, delete: () => {}, count: () => {}, update: () => {},
        createQueryBuilder: () => ({
            where: () => ({ getOne: () => {}, getMany: () => {}, andWhere: () => ({}) }),
            select: () => ({}), update: () => ({ set: () => ({ where: () => ({ execute: () => {} }) }) }),
            delete: () => ({ from: () => ({ where: () => ({ execute: () => {} }) }) })
        })
    }),
    manager: { getRepository: () => ({ delete: () => {} }) },
    createQueryRunner: () => ({
        connect: () => {}, startTransaction: () => {}, commitTransaction: () => {},
        rollbackTransaction: () => {}, release: () => {},
        manager: { getRepository: () => ({ delete: () => {} }) }
    })
};

// --- Routes Definition ---
`;

// เขียนบรรทัด app.use(...) สำหรับทุกไฟล์ที่เจอ
apiFiles.forEach(file => {
    fileContent += `
try {
    // Load: ${file}
    app.use('/', require('./api/${file}')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped ${file} due to error'); }
`;
});

fileContent += `\nmodule.exports = app;`;

// บันทึกไฟล์นี้ลงเครื่องจริง
fs.writeFileSync(tempRoutesFile, fileContent);
console.log(`📝 Generated static routes map: ${tempRoutesFile}`);

// -----------------------------------------------------------

const doc = {
  info: {
    title: 'Leave Management API',
    description: 'API Documentation (Auto Generated)',
    version: '1.0.0',
  },
  host: 'localhost:3000',
  basePath: '/api', // ✅ สำคัญ: ระบุ path หลัก
  schemes: ['http'],

};

// สั่ง Gen จากไฟล์ที่เราเพิ่งสร้าง (routes-static-generated.js)
const endpointsFiles = [tempRoutesFile];

swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
    console.log('✅ Swagger JSON generated successfully!');
    // fs.unlinkSync(tempRoutesFile); // ลบไฟล์ทิ้งเมื่อเสร็จ (หรือเก็บไว้ดู debug ก็ได้)
});