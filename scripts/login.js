import { chromium } from "playwright";
import TelegramBot from "node-telegram-bot-api";
import fs from "fs";

const USERNAME = process.env.LUNES_USERNAME;
const PASSWORD = process.env.LUNES_PASSWORD;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const LOGIN_URL = "https://betadash.lunes.host/login?next=/servers/35991";

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

async function sendTelegram(message, imagePath = null) {
  try {
    if (imagePath && fs.existsSync(imagePath)) {
      await bot.sendPhoto(TELEGRAM_CHAT_ID, imagePath, { caption: message });
    } else {
      await bot.sendMessage(TELEGRAM_CHAT_ID, message);
    }
  } catch (error) {
    console.error("Telegram error:", error.message);
  }
}

async function run() {
  console.log("Launching browser...");
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"]
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 }
  });

  const page = await context.newPage();

  // 注入 stealth 脚本
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
    window.chrome = { runtime: {} };
  });

  try {
    console.log("Opening login page...");
    await page.goto(LOGIN_URL, { waitUntil: "networkidle" });

    await page.fill('input[name="email"]', USERNAME);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForTimeout(5000); // 等待跳转或加载

    const screenshotPath = "login_result.png";
    await page.screenshot({ path: screenshotPath });

    await sendTelegram("✅ 登录完成，截图如下：", screenshotPath);
  } catch (error) {
    console.error("Login error:", error.message);
    await sendTelegram(`❌ 登录失败：${error.message}`);
  } finally {
    await browser.close();
  }
}

run();
