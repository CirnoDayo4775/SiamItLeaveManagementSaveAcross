const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'LeaveRequest',
  tableName: 'leave_request',
  columns: {
    id: {
      primary: true,
      type: 'varchar',
      length: 36,
      generated: 'uuid',
    },
    Repid: { type: 'varchar', nullable: true}, // Repid เชื่อมกับ id ของ users table
    employeeType: { type: 'varchar' },
    leaveType: { type: 'varchar' },
    startDate: { type: 'date' },
    endDate: { type: 'date' },
    startTime: { type: 'varchar', nullable: true },
    endTime: { type: 'varchar', nullable: true },
    reason: { type: 'text' },
    rejectedReason: { type: 'text', nullable: true},
    contact: { type: 'varchar', nullable: true },
    createdAt: { type: 'timestamp', createDate: true },
    statusChangeTime: { type: 'timestamp', nullable: true},
    status: { type: 'varchar', nullable: true},
    statusBy: { type: 'varchar', nullable: true}, // status เชื่อมกับ id ของ admin
    approvedTime: { type: 'timestamp', nullable: true }, // เวลาที่อนุมัติ
    rejectedTime: {type: 'timestamp', nullable: true},
    attachments: { type: 'longtext', nullable: true }, // json string ของ array ชื่อไฟล์แนบ รองรับไฟล์หลายไฟล์
    isRead: { type: 'boolean', default: false, nullable: false },
    backdated: { type: 'boolean', default: false, nullable: false }, // Indicates if the leave request is backdated
  },
});