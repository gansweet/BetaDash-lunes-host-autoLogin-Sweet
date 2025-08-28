const axios = require("axios");
const cheerio = require("cheerio");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const COOKIE = process.env.LUNES_COOKIE; // 登录后的完整 Cookie
const DASHBOARD_URL = "https://betadash.lunes.host/dashboard"; // 目标URL
const CSRF_HEADER_NAME = "x-csrftoken"; // 假设 CSRF 名称
let csrfToken = "";

// 发送 Telegram 通知
async function sendTelegramMessage(message) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message
    });
    console.log("✅ Telegram notification sent.");
  } catch (error) {
    console.error("❌ Failed to send Telegram message:", error.message);
  }
}

// 获取 CSRF Token（如果页面有）
async function getCsrfToken() {
  try {
    const response = await axios.get(DASHBOARD_URL, {
      headers: {
        "Cookie": COOKIE,
        "User-Agent": "Mozilla/5.0"
      }
    });
    const $ = cheerio.load(response.data);
    // 检查 meta 或 hidden input
    const token = $('input[name="csrfmiddlewaretoken"]').val() || $("meta[name='csrf-token']").attr("content");
    return token || "";
  } catch (error) {
    console.error("❌ Failed to fetch CSRF token:", error.message);
    return "";
  }
}

// 主逻辑
(async () => {
  try {
    csrfToken = await getCsrfToken();

    const headers = {
      "Cookie": COOKIE,
      "User-Agent": "Mozilla/5.0"
    };

    if (csrfToken) {
      headers[CSRF_HEADER_NAME] = csrfToken;
      console.log(`✅ CSRF Token detected: ${csrfToken}`);
    } else {
      console.log("ℹ️ No CSRF token detected, proceeding without it.");
    }

    const response = await axios.get(DASHBOARD_URL, { headers });

    if (response.status === 200) {
      console.log("✅ Dashboard accessed successfully.");
      await sendTelegramMessage("✅ Keepalive successful: Dashboard accessed.");
    } else {
      console.log(`❌ Unexpected status: ${response.status}`);
      await sendTelegramMessage(`❌ Error: Status ${response.status}`);
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error fetching dashboard:", error.message);
    await sendTelegramMessage(`❌ Error fetching dashboard: ${error.message}`);
    process.exit(1);
  }
})();
