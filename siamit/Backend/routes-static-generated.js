
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

try {
    // Load: AnnouncementsController.js
    app.use('/', require('./api/AnnouncementsController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped AnnouncementsController.js due to error'); }

try {
    // Load: CustomHolidayController.js
    app.use('/', require('./api/CustomHolidayController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped CustomHolidayController.js due to error'); }

try {
    // Load: DashboardIndexController.js
    app.use('/', require('./api/DashboardIndexController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped DashboardIndexController.js due to error'); }

try {
    // Load: DepartmentController.js
    app.use('/', require('./api/DepartmentController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped DepartmentController.js due to error'); }

try {
    // Load: EmployeeController.js
    app.use('/', require('./api/EmployeeController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped EmployeeController.js due to error'); }

try {
    // Load: ExampleController.js
    app.use('/', require('./api/ExampleController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped ExampleController.js due to error'); }

try {
    // Load: LeaveHistoryController.js
    app.use('/', require('./api/LeaveHistoryController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped LeaveHistoryController.js due to error'); }

try {
    // Load: LeaveQuotaController.js
    app.use('/', require('./api/LeaveQuotaController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped LeaveQuotaController.js due to error'); }

try {
    // Load: LeaveQuotaResetController.js
    app.use('/', require('./api/LeaveQuotaResetController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped LeaveQuotaResetController.js due to error'); }

try {
    // Load: LeaveRequestController.js
    app.use('/', require('./api/LeaveRequestController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped LeaveRequestController.js due to error'); }

try {
    // Load: LeaveUsedController.js
    app.use('/', require('./api/LeaveUsedController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped LeaveUsedController.js due to error'); }

try {
    // Load: LineController.js
    app.use('/', require('./api/LineController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped LineController.js due to error'); }

try {
    // Load: LineLoginController.js
    app.use('/', require('./api/LineLoginController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped LineLoginController.js due to error'); }

try {
    // Load: LineOAController.js
    app.use('/', require('./api/LineOAController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped LineOAController.js due to error'); }

try {
    // Load: LineRichMenuController.js
    app.use('/', require('./api/LineRichMenuController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped LineRichMenuController.js due to error'); }

try {
    // Load: LoginController.js
    app.use('/', require('./api/LoginController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped LoginController.js due to error'); }

try {
    // Load: MidController.js
    app.use('/', require('./api/MidController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped MidController.js due to error'); }

try {
    // Load: NotificationBellController.js
    app.use('/', require('./api/NotificationBellController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped NotificationBellController.js due to error'); }

try {
    // Load: PositionController.js
    app.use('/', require('./api/PositionController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped PositionController.js due to error'); }

try {
    // Load: ProfileController.js
    app.use('/', require('./api/ProfileController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped ProfileController.js due to error'); }

try {
    // Load: RegisterController.js
    app.use('/', require('./api/RegisterController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped RegisterController.js due to error'); }

try {
    // Load: SuperAdminController.js
    app.use('/', require('./api/SuperAdminController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped SuperAdminController.js due to error'); }

try {
    // Load: TpyeLeaveController.js
    app.use('/', require('./api/TpyeLeaveController.js')(mockDB));
} catch (e) { console.log('⚠️ Warning: Skipped TpyeLeaveController.js due to error'); }

module.exports = app;