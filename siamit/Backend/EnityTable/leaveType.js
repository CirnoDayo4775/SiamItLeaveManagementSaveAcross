const { v4: uuidv4 } = require('uuid');
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'LeaveType',
    tableName: 'leave_type',
    columns: {
        id: { //ไอ้ id ของ LeaveType เชื่อมกับ leave_requst เขิงอมกับ id >>> leavetype
            primary: true,
            type: 'varchar',
            length: 36,
            generated: 'uuid',
        },
        leave_type_en: { type: 'varchar' },
        leave_type_th: { type: 'varchar' },
        require_attachment: { type: 'boolean', default: false, nullable: false },
        // Add soft delete fields
        deleted_at: { type: 'timestamp', nullable: true },
        is_active: { type: 'boolean', default: true, nullable: false },
    },

})