// const { EntitySchema } = require('typeorm');

// const LineUser = new EntitySchema({
//   name: 'LineUser',
//   tableName: 'line_users',
//   columns: {
//     id: {
//       primary: true,
//       type: 'int',
//       generated: true
//     },
//     lineUserId: {
//       type: 'varchar',
//       length: 50,
//       unique: true,
//       nullable: false
//     },
//     displayName: {
//       type: 'varchar',
//       length: 100,
//       nullable: true
//     },
//     pictureUrl: {
//       type: 'varchar',
//       length: 500,
//       nullable: true
//     },
//     statusMessage: {
//       type: 'varchar',
//       length: 200,
//       nullable: true
//     },
//     userId: {
//       type: 'int',
//       nullable: true
//     },
//     isActive: {
//       type: 'boolean',
//       default: true
//     },
//     createdAt: {
//       type: 'timestamp',
//       default: () => 'CURRENT_TIMESTAMP'
//     },
//     updatedAt: {
//       type: 'timestamp',
//       default: () => 'CURRENT_TIMESTAMP',
//       onUpdate: 'CURRENT_TIMESTAMP'
//     }
//   },
//   relations: {
//     user: {
//       type: 'many-to-one',
//       target: 'User',
//       joinColumn: {
//         name: 'userId',
//         referencedColumnName: 'id'
//       }
//     }
//   }
// });

// module.exports = LineUser; 