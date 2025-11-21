const { createSuperAdmin } = require('./create-superadmin.js');

async function createMultipleSuperAdmins(count = 1) {
  console.log(`🎯 Creating ${count} SuperAdmin account(s)...\n`);
  
  for (let i = 1; i <= count; i++) {
    console.log(`\n📝 Creating SuperAdmin #${i}:`);
    console.log('=' .repeat(50));
    await createSuperAdmin();
    console.log('=' .repeat(50));
    
    if (i < count) {
      console.log('\n⏳ Waiting 2 seconds before creating next account...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log(`\n🎉 Successfully created ${count} SuperAdmin account(s)!`);
}

// Get count from command line argument
const count = parseInt(process.argv[2]) || 1;

if (require.main === module) {
  createMultipleSuperAdmins(count);
}

module.exports = { createMultipleSuperAdmins };
