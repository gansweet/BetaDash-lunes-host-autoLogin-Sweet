import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const username = process.env.LUNES_USERNAME;
const password = process.env.LUNES_PASSWORD;
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

const LOGIN_URL = 'https://betadash.lunes.host/login?next=/servers/35991';

async function sendTelegram(message, screenshotPath = null) {
  const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
  await axios.post(url, {
    chat_id: telegramChatId,
    text: message,
    parse_mode: 'HTML'
  });

  if (screenshotPath && fs.existsSync(screenshotPath)) {
    const photoUrl = `https://api.telegram.org/bot${telegramToken}/sendPhoto`;
    const form = new FormData();
    form.append('chat_id', telegramChatId);
    form.append('photo', fs.createReadStream(screenshotPath));
    await axios.post(photoUrl, form, { headers: form.getHeaders() });
  }
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();
  const screenshotPath = path.join(process.cwd(), 'login_result.png');

  try {
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 检测 Cloudflare 按钮验证
    const cfVerifyButton = page.locator('input[type="checkbox"], button:has-text("Verify")');
    if (await cfVerifyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Cloudflare 验证：点击按钮...');
      await cfVerifyButton.click({ delay: 500 });
      await page.waitForTimeout(5000);
    }

    // 输入账号密码
    await page.waitForSelector('input[name="email"]', { timeout: 15000 });
    await page.fill('input[name="email"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // 等待跳转完成
    await page.waitForURL('**/servers/**', { timeout: 20000 });

    // 截图结果
    await page.screenshot({ path: screenshotPath, fullPage: true });

    await sendTelegram('✅ 登录成功并完成验证', screenshotPath);
    console.log('登录成功，截图已发送至 Telegram');

  } catch (error) {
    console.error('登录过程出错：', error.message);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await sendTelegram(`❌ 登录失败：${error.message}`, screenshotPath);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
