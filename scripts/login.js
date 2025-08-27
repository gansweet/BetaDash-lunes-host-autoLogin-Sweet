import { chromium } from 'playwright-extra';
import StealthPlugin from 'playwright-extra-plugin-stealth';
import fetch from 'node-fetch';
import fs from 'fs';

chromium.use(StealthPlugin());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const USERNAME = process.env.LUNES_USERNAME;
const PASSWORD = process.env.LUNES_PASSWORD;

const LOGIN_URL = 'https://betadash.lunes.host/login?next=/servers/35991';

async function sendTelegramMessage(message, screenshotPath) {
  const formData = new FormData();
  formData.append('chat_id', TELEGRAM_CHAT_ID);
  formData.append('caption', message);
  formData.append('photo', fs.createReadStream(screenshotPath));

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    body: formData
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });

    await page.fill('input[name="email"]', USERNAME);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForTimeout(5000);

    const screenshotPath = 'screenshot.png';
    await page.screenshot({ path: screenshotPath });
    await sendTelegramMessage('✅ 登录完成，状态截图：', screenshotPath);
  } catch (error) {
    console.error('❌ 登录失败:', error);
    await sendTelegramMessage(`❌ 登录失败: ${error.message}`, 'screenshot.png');
  } finally {
    await browser.close();
  }
})();
