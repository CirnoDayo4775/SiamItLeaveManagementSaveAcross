const { EntitySchema } = require('typeorm');
module.exports = new EntitySchema({
    name: 'Announcements',
    tableName: 'announcements',
    columns: {
        id: {
            primary: true,
            type: 'varchar',
            length: 36,
            generated: 'uuid',
        },
        subject: {
            type: 'varchar',
            nullable: true,
        },
        detail: {
            type: 'text',
        },
        Image: {
            type: 'varchar',
            nullable: true,
        },
        createdBy: {
            type: 'varchar',
            nullable: true,
        },
        createdAt: {
            type: 'timestamp',
            createDate: true,
        },
    },
});