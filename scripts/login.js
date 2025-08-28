// scripts/login.js
import { chromium } from '@playwright/test';
import fs from 'fs';
import FormData from 'form-data';

const LOGIN_URL = 'https://betadash.lunes.host/login?next=/servers/35991';

async function notifyTelegram({ ok, stage, msg, screenshotPath }) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    const text = [
      `🔔 Lunes 自动操作：${ok ? '✅ 成功' : '❌ 失败'}`,
      `阶段：${stage}`,
      msg ? `信息：${msg}` : '',
      `时间：${new Date().toISOString()}`
    ].filter(Boolean).join('\n');

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });

    if (screenshotPath && fs.existsSync(screenshotPath)) {
      const photoUrl = `https://api.telegram.org/bot${token}/sendPhoto`;
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('caption', `Lunes 自动操作截图（${stage}）`);
      form.append('photo', new Blob([fs.readFileSync(screenshotPath)]), 'screenshot.png');
      await fetch(photoUrl, { method: 'POST', body: form });
    }
  } catch (e) {
    console.log('[WARN] Telegram 通知失败：', e.message);
  }
}

function envOrThrow(name) {
  const v = process.env[name];
  if (!v) throw new Error(`环境变量 ${name} 未设置`);
  return v;
}

async function main() {
  const username = envOrThrow('LUNES_USERNAME');
  const password = envOrThrow('LUNES_PASSWORD');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36',
    locale: 'en-US'
  });

  const page = await context.newPage();
  const screenshot = (name) => `./${name}.png`;

  try {
    // 1. 打开登录页
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 2. 输入用户名密码
    await page.fill('input[name="email"]', username);
    await page.fill('input[name="password"]', password);

    // 3. 检测 Cloudflare 验证 iframe
    const cfIframeSelector = 'iframe[src*="challenges.cloudflare.com"]';
    if (await page.locator(cfIframeSelector).count()) {
      console.log('[INFO] 检测到 Cloudflare 验证，等待自动放行...');
      // 等待验证通过（iframe 消失）
      await page.waitForSelector(cfIframeSelector, { state: 'detached', timeout: 30000 }).catch(() => {});
    }

    // 4. 截图，点击 Submit
    const spBefore = screenshot('02-before-submit');
    await page.screenshot({ path: spBefore, fullPage: true });

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click({ timeout: 15000 });

    // 等待跳转完成
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // 5. 登录后截图
    const spAfter = screenshot('03-after-submit');
    await page.screenshot({ path: spAfter, fullPage: true });

    const url = page.url();
    const successHint = await page.locator('text=/Dashboard|Logout|Sign out|控制台/i').count();
    if (successHint > 0 || !/\/login/.test(url)) {
      await notifyTelegram({ ok: true, stage: '登录成功', msg: `URL：${url}`, screenshotPath: spAfter });
      process.exitCode = 0;
      return;
    }

    // 登录失败
    await notifyTelegram({ ok: false, stage: '登录失败', msg: '仍在登录页', screenshotPath: spAfter });
    process.exitCode = 1;
  } catch (e) {
    const sp = screenshot('99-error');
    try { await page.screenshot({ path: sp, fullPage: true }); } catch {}
    await notifyTelegram({ ok: false, stage: '异常', msg: e.message, screenshotPath: sp });
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

await main();
