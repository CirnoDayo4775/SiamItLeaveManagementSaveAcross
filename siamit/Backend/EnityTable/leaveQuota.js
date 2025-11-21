const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'LeaveQuota',
  tableName: 'leave_quota',
  columns: {
    id: {
      primary: true,
      type: 'uuid',
      generated: 'uuid',
    },
    positionId: {
      type: 'varchar',
      nullable: false,
    },
    leaveTypeId: {
      type: 'varchar',
      nullable: false,
    },
    quota: {
      type: 'int',
      nullable: false,
      default: 0,
    },
  },
});
