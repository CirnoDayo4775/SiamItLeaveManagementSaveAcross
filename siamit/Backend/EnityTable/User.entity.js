const { EntitySchema } = require('typeorm');
const { v4: uuidv4 } = require('uuid');

module.exports = new EntitySchema({
  name: 'User',
  tableName: 'users',
  columns: {
    // Primary Key
    id: {
      primary: true,
      type: 'varchar',
      length: 36,
      generated: 'uuid',
    },
    
    // Basic User Information
    name: {
      type: 'varchar',
      unique: true,
      nullable: true,
    },
    Email: {
      type: 'varchar',
      unique: true,
      nullable: true,
      default: null,
    },
    Role: { 
      type: 'varchar', 
      default: 'user' 
    },
    
    // Authentication & Security
    Password: { 
      type: 'varchar',
      nullable: true,
      default: null,
    },
    Token: { 
      type: 'varchar', 
      default: null 
    },
    
    // External Integrations
    lineUserId: { 
      type: 'varchar', 
      nullable: true, 
      unique: true 
    },
    
    // Profile & Media
    avatar_url: { 
      type: 'varchar', 
      default: null 
    },
    
    // Personal Information
    gender: {
      type: 'varchar',
      nullable: true,
    },
    dob: {
      type: 'date',
      nullable: true,
    },
    phone_number: {
      type: 'varchar',
      nullable: true
    },
    
    // Work Information
    department: {
      type: 'varchar',
      nullable: true,
    },
    position: {
      type: 'varchar',
      nullable: true,
    },
    start_work: {
      type: 'date',
      nullable: true,
    },
    end_work: {
      type: 'date',
      nullable: true,
    }
  },
});