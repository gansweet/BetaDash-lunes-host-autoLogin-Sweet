const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(60000);

  console.log('🌐 打开登录页面...');
  await page.goto('https://betadash.lunes.host/login?next=/servers/35991', {
    waitUntil: 'networkidle2',
  });

  // 等待邮箱输入框
  console.log('⌛ 等待邮箱输入框...');
  await page.waitForSelector('input[name="email"]', { visible: true });

  // 输入邮箱和密码
  await page.type('input[name="email"]', process.env.EMAIL, { delay: 50 });
  await page.type('input[name="password"]', process.env.PASSWORD, { delay: 50 });

  // 点击登录按钮
  await page.click('button[type="submit"]');
  console.log('✅ 已点击登录按钮，等待验证...');

  // 处理 Cloudflare 验证
  try {
    await page.waitForSelector('#cf-stage > div iframe', { timeout: 15000 });
    console.log('🔍 检测到 Cloudflare 验证框，尝试点击 Verify 按钮...');
    const frames = page.frames();
    for (const frame of frames) {
      const checkbox = await frame.$('input[type="checkbox"]');
      if (checkbox) {
        await checkbox.click();
        console.log('✅ 已点击 Cloudflare 验证按钮');
        break;
      }
    }
  } catch {
    console.log('⚠️ 未检测到 Cloudflare 验证框，可能没有验证步骤');
  }

  // 等待登录完成
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
  console.log('✅ 登录成功，截图保存中...');

  const screenshotPath = path.join(__dirname, 'screenshot.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  // 发送到 Telegram
  if (process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    const axios = require('axios');
    const formData = new FormData();
    formData.append('chat_id', process.env.TELEGRAM_CHAT_ID);
    formData.append('photo', fs.createReadStream(screenshotPath));

    await axios.post(
      `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendPhoto`,
      formData,
      { headers: formData.getHeaders() }
    );
    console.log('✅ 截图已发送到 Telegram');
  }

  await browser.close();
})();
