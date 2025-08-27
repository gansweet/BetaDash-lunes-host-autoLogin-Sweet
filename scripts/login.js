const playwright = require('playwright-extra');
const stealth = require('playwright-extra-plugin-stealth')();
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');

playwright.use(stealth);

(async () => {
  const username = process.env.LUNES_USERNAME;
  const password = process.env.LUNES_PASSWORD;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!username || !password || !botToken || !chatId) {
    console.error('❌ 环境变量未设置');
    process.exit(1);
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🌐 打开登录页面...');
    await page.goto('https://betadash.lunes.host/login?next=/servers/35991', {
      waitUntil: 'networkidle'
    });

    console.log('✅ 填写表单...');
    await page.fill('input[name="email"]', username);
    await page.fill('input[name="password"]', password);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"]')
    ]);

    console.log('✅ 登录成功，截图...');
    const screenshotPath = path.join(__dirname, 'screenshot.png');
    await page.screenshot({ path: screenshotPath });

    // 上传到 Telegram
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('photo', fs.createReadStream(screenshotPath));

    await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      body: form
    });

    console.log('📤 截图已发送到 Telegram');
    await browser.close();
  } catch (err) {
    console.error('❌ 登录失败，错误信息:', err.message);
    await browser.close();
    process.exit(1);
  }
})();
