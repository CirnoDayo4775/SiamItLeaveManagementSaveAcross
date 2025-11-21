const { EntitySchema } = require('typeorm');
const { v4: uuidv4 } = require('uuid');

module.exports = new EntitySchema({
    name: 'LeaveUsed',
    tableName: 'leave_used',
    columns: {
        id: {
            primary: true,
            type: 'varchar',
            length: 36,
            generated: 'uuid',
        },
        user_id: {
            type: 'varchar',
            length: 36,
            nullable: false,
        },
        leave_type: {
            type: 'varchar',
            nullable: false,
        },
        days: {
            type: 'int',
            default: 0,
            nullable: true,
        },
        hour: {
            type: 'int',
            default: 0,
            nullable: true,
        },
        created_at: {
            type: 'timestamp',
            default: () => 'CURRENT_TIMESTAMP',
        },
        updated_at: {
            type: 'timestamp',
            default: () => 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
        },
    },
    relations: {
        user: {
            type: 'many-to-one',
            target: 'User',
            joinColumn: {
                name: 'user_id',
                referencedColumnName: 'id',
            },
        },
    },
    beforeInsert: (entity) => {
        if (!entity.id) {
            entity.id = uuidv4();
        }
    },
});
