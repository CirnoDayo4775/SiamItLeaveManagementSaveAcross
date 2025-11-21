const ngrok = require('ngrok');
const config = require('./config');

async function startNgrok() {
  try {
    console.log('🚀 Starting ngrok tunnel...');
    
    const url = await ngrok.connect({
      addr: config.server.port,
      authtoken: process.env.NGROK_AUTH_TOKEN // Optional: Add your ngrok auth token to .env
    });
    
    console.log('✅ ngrok tunnel is running!');
    console.log(`🌐 Public URL: ${url}`);
    console.log(`🔗 Local URL: http://localhost:${config.server.port}`);
    console.log('\n📋 You can now share this URL for external access');
    console.log('⚠️  Remember to stop the tunnel when done: Ctrl+C');
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping ngrok tunnel...');
      await ngrok.kill();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error starting ngrok:', error.message);
    process.exit(1);
  }
}

startNgrok();
