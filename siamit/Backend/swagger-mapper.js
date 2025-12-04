// swagger-mapper.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// 1. จำลอง Database ปลอมๆ (Mock) เพื่อให้ Controller ไม่พังตอนถูกเรียก
const mockAppDataSource = {
    getRepository: () => ({
        find: () => [],
        findOne: () => {},
        findOneBy: () => {},
        save: () => {},
        create: () => {},
        delete: () => {},
        count: () => {},
        update: () => {},
        createQueryBuilder: () => ({
            where: () => ({ getOne: () => {}, getMany: () => {} }),
            select: () => ({}),
            update: () => ({ set: () => ({ where: () => ({ execute: () => {} }) }) })
        })
    }),
    manager: {
        getRepository: () => ({ delete: () => {} })
    },
    createQueryRunner: () => ({
        connect: () => {},
        startTransaction: () => {},
        commitTransaction: () => {},
        rollbackTransaction: () => {},
        release: () => {},
        manager: { getRepository: () => ({ delete: () => {} }) }
    })
};

// 2. อ่านไฟล์ Controller ทั้งหมดแล้วสั่งรันด้วย Mock DB
const apiDir = path.join(__dirname, 'api');
const files = fs.readdirSync(apiDir).filter(file => file.endsWith('.js'));

files.forEach(file => {
    try {
        const controllerPath = path.join(apiDir, file);
        const controller = require(controllerPath);
        
        // ถ้าเป็น Function (ตาม Pattern ของคุณ) ให้ยัด Mock DB เข้าไป
        if (typeof controller === 'function') {
            app.use('/', controller(mockAppDataSource)); 
        }
    } catch (err) {
        console.warn(`⚠️ Warning skipped ${file}: ${err.message}`);
    }
});

module.exports = app;