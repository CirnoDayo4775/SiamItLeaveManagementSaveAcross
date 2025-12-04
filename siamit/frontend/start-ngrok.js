const { spawn } = require("child_process");

async function startNgrok() {
  console.log("🚀 Starting ngrok tunnel...");

  const ngrok = spawn("ngrok", ["http", "3000"], { shell: true });

  ngrok.stdout.on("data", (data) => {
    const text = data.toString();

    // ดึง URL อัตโนมัติ
    const match = text.match(/https:\/\/[a-z0-9-]+\.ngrok-(free|app)\.app/);
    if (match) {
      console.log("🌐 Public URL:", match[0]);
    }

    console.log(text);
  });

  ngrok.stderr.on("data", (data) => {
    console.error("Error:", data.toString());
  });

  process.on("SIGINT", () => {
    console.log("\n🛑 Stopping ngrok...");
    ngrok.kill();
    process.exit(0);
  });
}

startNgrok();
