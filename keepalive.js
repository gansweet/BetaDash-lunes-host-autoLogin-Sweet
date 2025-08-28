const axios = require("axios");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const COOKIE = process.env.LUNES_COOKIE; // 完整 cookie: session + cf_clearance
const DASHBOARD_URL = "https://betadash.lunes.host/servers/35991";

// 发送 Telegram 消息
async function sendTelegramMessage(message) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message
    });
    console.log("✅ Telegram notification sent.");
  } catch (error) {
    console.error("❌ Telegram send failed:", error.message);
  }
}

// 主逻辑
(async () => {
  try {
    const headers = {
      "Cookie": COOKIE,
      "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://betadash.lunes.host/dashboard",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1"
    };

    const response = await axios.get(DASHBOARD_URL, { headers });

    if (response.status === 200 && response.data.includes("Manage Server")) {
      console.log("✅ Dashboard accessed successfully.");
      await sendTelegramMessage("✅ Keepalive successful: Dashboard accessed.");
    } else {
      console.error(`❌ Unexpected status: ${response.status}`);
      await sendTelegramMessage(`❌ Error: Status ${response.status}`);
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error fetching dashboard:", error.message);
    await sendTelegramMessage(`❌ Error fetching dashboard: ${error.message}`);
    process.exit(1);
  }
})();
