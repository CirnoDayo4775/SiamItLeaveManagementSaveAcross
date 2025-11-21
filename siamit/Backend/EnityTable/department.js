const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'Department',
    tableName: 'department',
    columns: {
        id: {
            primary: true,
            type: 'varchar',
            length: 36,
            generated: 'uuid',
        },
        department_name_en: { type: 'varchar' },
        department_name_th: { type: 'varchar' },
    },
});