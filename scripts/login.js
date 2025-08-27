import { chromium } from 'playwright';
import fs from 'fs';
import fetch from 'node-fetch';

const USERNAME = process.env.LUNES_USERNAME;
const PASSWORD = process.env.LUNES_PASSWORD;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const LOGIN_URL = 'https://betadash.lunes.host/login?next=/servers/35991';

(async () => {
  const browser = await chromium.launch({
    headless: true, // GitHub Actions必须headless
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    console.log('▶ 打开登录页面...');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 检测是否有Cloudflare验证
    if (await page.$('input[name="email"]') === null) {
      console.log('⚠ 检测到Cloudflare人机验证，尝试等待并处理...');
      await page.waitForTimeout(5000);
      if (await page.$('iframe')) {
        console.log('⚠ 页面包含iframe验证，尝试模拟点击...');
        const frame = page.frameLocator('iframe');
        await frame.locator('input[type="checkbox"]').click({ timeout: 20000 });
        await page.waitForTimeout(5000);
      }
    }

    console.log('▶ 输入账号信息...');
    await page.fill('input[name="email"]', USERNAME);
    await page.fill('input[name="password"]', PASSWORD);

    console.log('▶ 点击登录...');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(5000);

    // 登录成功后截图
    const screenshotPath = 'screenshot.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log('▶ 发送截图到Telegram...');
    const fileBuffer = fs.readFileSync(screenshotPath);
    const tgUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
    const formData = new FormData();
    formData.append('chat_id', CHAT_ID);
    formData.append('photo', new Blob([fileBuffer]), 'screenshot.png');
    formData.append('caption', '✅ 登录成功，以下为页面截图');

    await fetch(tgUrl, {
      method: 'POST',
      body: formData
    });

    console.log('✅ Telegram 通知发送成功');
  } catch (err) {
    console.error('❌ 登录失败:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
