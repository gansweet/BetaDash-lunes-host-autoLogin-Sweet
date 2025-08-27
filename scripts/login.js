// scripts/login.js
import { chromium } from '@playwright/test';
import fs from 'fs';
import FormData from 'form-data';

const LOGIN_URL = 'https://betadash.lunes.host/login?next=/servers/35991';
const SERVER_URL = 'https://betadash.lunes.host/servers/35991';

// Telegram 通知函数
async function notifyTelegram({ ok, stage, msg, screenshotPath }) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      console.log('[WARN] TELEGRAM_BOT_TOKEN 或 TELEGRAM_CHAT_ID 未设置，跳过通知');
      return;
    }

    const text = [
      `🔔 Lunes 自动操作：${ok ? '✅ 成功' : '❌ 失败'}`,
      `阶段：${stage}`,
      msg ? `信息：${msg}` : '',
      `时间：${new Date().toISOString()}`
    ].filter(Boolean).join('\n');

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    });

    // 如果有截图，再发图
    if (screenshotPath && fs.existsSync(screenshotPath)) {
      const photoUrl = `https://api.telegram.org/bot${token}/sendPhoto`;
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('caption', `Lunes 自动操作截图（${stage}）`);
      form.append('photo', fs.createReadStream(screenshotPath));
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
  const email = envOrThrow('LUNES_USERNAME');
  const password = envOrThrow('LUNES_PASSWORD');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  const screenshot = (name) => `./${name}.png`;

  try {
    // 1) 打开登录页
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const spOpen = screenshot('01-open-login');
    await page.screenshot({ path: spOpen, fullPage: true });

    // 填写 Email 和 Password
    const emailInput = page.locator('input[name="email"]');
    const passInput = page.locator('input[name="password"]');
    await emailInput.waitFor({ state: 'visible', timeout: 30_000 });
    await passInput.waitFor({ state: 'visible', timeout: 30_000 });

    await emailInput.fill(email);
    await passInput.fill(password);

    const loginBtn = page.locator('button[type="submit"]');
    await loginBtn.waitFor({ state: 'visible', timeout: 15_000 });

    const spBefore = screenshot('02-before-submit');
    await page.screenshot({ path: spBefore, fullPage: true });

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30_000 }),
      loginBtn.click({ timeout: 10_000 })
    ]);

    // 2) 登录完成截图
    const spAfter = screenshot('03-after-submit');
    await page.screenshot({ path: spAfter, fullPage: true });

    const url = page.url();
    if (url.startsWith(SERVER_URL)) {
      await notifyTelegram({ ok: true, stage: '登录成功', msg: `已跳转到 ${url}`, screenshotPath: spAfter });
    } else {
      await notifyTelegram({ ok: false, stage: '登录失败', msg: `当前 URL：${url}`, screenshotPath: spAfter });
      process.exitCode = 1;
      return;
    }

    // 3) 进入服务器页面再截图
    const spServer = screenshot('04-server-page');
    await page.waitForLoadState('networkidle', { timeout: 30_000 });
    await page.screenshot({ path: spServer, fullPage: true });
    await notifyTelegram({ ok: true, stage: '服务器详情', msg: '已成功进入服务器页面', screenshotPath: spServer });

    // 可选逻辑：如果页面有 Console，可以点击 Restart + 输入命令
    const restartBtn = page.locator('button:has-text("Restart")');
    if (await restartBtn.count()) {
      await restartBtn.click();
      await notifyTelegram({ ok: true, stage: '点击 Restart', msg: 'VPS 重启中' });
      await page.waitForTimeout(10000);
    }

    process.exitCode = 0;
  } catch (e) {
    const spError = screenshot('99-error');
    try { await page.screenshot({ path: spError, fullPage: true }); } catch {}
    await notifyTelegram({ ok: false, stage: '异常', msg: e?.message || String(e), screenshotPath: fs.existsSync(spError) ? spError : undefined });
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

await main();
