const { EntitySchema } = require('typeorm');
module.exports = new EntitySchema({
    name: 'CustomHoliday',
    tableName: 'custom_holiday',
    columns: {
        id: {
            primary: true,
            type: 'varchar',
            length: 36,
            generated: 'uuid',
        },
        title: {
            type: 'varchar',
        },
        description: {
            type: 'varchar',
        },
        date: {
            type: 'varchar',
        },
        createdAt: {
            type: 'timestamp',
            createDate: true,
        },
        createdBy: {
            type: 'varchar',
        },
        type: {
            type: 'varchar',
            length: 20,
            default: 'company',
        },
    },
});