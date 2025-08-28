import axios from "axios";

const BASE_URL = "https://betadash.lunes.host";
const DASHBOARD_URL = `${BASE_URL}/servers/35991`; // 可改为你的目标页面

const COOKIES = process.env.LUNES_COOKIES; // 从 GitHub Secrets 获取
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!COOKIES) {
  console.error("❌ Missing LUNES_COOKIES environment variable.");
  process.exit(1);
}

async function checkSession() {
  try {
    const res = await axios.get(DASHBOARD_URL, {
      headers: {
        "Cookie": COOKIES,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Connection": "keep-alive",
        "Referer": url
      }
    });

    if (res.status === 200 && res.data.includes("Server Status")) {
      console.log("✅ Session valid, dashboard loaded successfully.");
      await sendTelegram(`✅ Lunes KeepAlive: Session OK\nURL: ${DASHBOARD_URL}`);
    } else {
      console.log("⚠️ Session might be invalid, response content check failed.");
      await sendTelegram(`⚠️ Lunes KeepAlive: Session might be invalid.`);
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Error fetching dashboard:", err.message);
    await sendTelegram(`❌ Lunes KeepAlive: Error fetching dashboard.\n${err.message}`);
    process.exit(1);
  }
}

async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("⚠️ Telegram credentials missing, skip notify.");
    return;
  }
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message
    });
    console.log("✅ Telegram notification sent.");
  } catch (e) {
    console.error("❌ Failed to send Telegram message:", e.message);
  }
}

checkSession();
