import fs from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { chromium } from 'playwright-extra';
import stealth from 'playwright-stealth';

chromium.use(stealth());

const LOGIN_URL = 'https://betadash.lunes.host/login?next=/servers/35991';

// Telegram 通知
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
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
    });

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
  const username = envOrThrow('LUNES_USERNAME');
  const password = envOrThrow('LUNES_PASSWORD');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
  });
  const page = await context.newPage();

  const screenshot = (name) => `./${name}.png`;

  try {
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 90_000 });

    // 检测 Cloudflare 验证（最多重试 3 次，每次等待 10 秒）
    let retry = 0;
    while (retry < 3) {
      const cfText = await page.locator('text=/Verify you are human|review the security|正在检查/i').first();
      if (await cfText.count()) {
        console.log(`[INFO] 检测到 Cloudflare 验证，等待 10 秒后重试 (${retry + 1}/3)...`);
        await page.waitForTimeout(10_000);
        retry++;
        continue;
      }
      break;
    }

    if (retry >= 3) {
      const sp = screenshot('01-human-check');
      await page.screenshot({ path: sp, fullPage: true });
      await notifyTelegram({ ok: false, stage: '打开登录页', msg: 'Cloudflare 验证无法通过', screenshotPath: sp });
      process.exitCode = 2;
      return;
    }

    // 输入账号密码
    await page.locator('input[name="username"]').waitFor({ state: 'visible', timeout: 30_000 });
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);

    const spBefore = screenshot('02-before-submit');
    await page.screenshot({ path: spBefore, fullPage: true });

    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 30_000 }),
      page.click('button[type="submit"]', { timeout: 10_000 })
    ]);

    const spAfter = screenshot('03-after-submit');
    await page.screenshot({ path: spAfter, fullPage: true });

    const url = page.url();
    const successHint = await page.locator('text=/Dashboard|Logout|Sign out|控制台|面板/i').count();

    if (successHint > 0 || !/\/login/i.test(url)) {
      await notifyTelegram({ ok: true, stage: '登录成功', msg: `URL：${url}`, screenshotPath: spAfter });
      process.exitCode = 0;
    } else {
      await notifyTelegram({ ok: false, stage: '登录失败', msg: '仍在登录页', screenshotPath: spAfter });
      process.exitCode = 1;
    }
  } catch (e) {
    const sp = screenshot('99-error');
    try { await page.screenshot({ path: sp, fullPage: true }); } catch {}
    await notifyTelegram({ ok: false, stage: '异常', msg: e?.message || String(e), screenshotPath: sp });
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

await main();
