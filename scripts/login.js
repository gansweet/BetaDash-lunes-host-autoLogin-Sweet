import puppeteer from 'puppeteer';
import fetch from 'node-fetch';
import fs from 'fs';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const LOGIN_URL = process.env.LOGIN_URL || 'https://betadash.lunes.host/login?next=/servers/35991';
const LOGIN_USERNAME = process.env.LOGIN_USERNAME;
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD;

async function sendToTelegram(message, screenshotPath = null) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });

        if (screenshotPath && fs.existsSync(screenshotPath)) {
            const formData = new FormData();
            formData.append('chat_id', TELEGRAM_CHAT_ID);
            formData.append('photo', fs.createReadStream(screenshotPath));

            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                body: formData
            });
        }
    } catch (err) {
        console.error('发送 Telegram 消息失败:', err);
    }
}

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {
        await page.goto(LOGIN_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // ✅ 检测 Cloudflare 验证页面
        if (await page.$('input[type="checkbox"][name="cf-turnstile-response"], div[data-sitekey]')) {
            await sendToTelegram('⚠️ 检测到 Cloudflare 验证，正在尝试自动处理...');
            try {
                await page.waitForSelector('input[type="checkbox"], button', { timeout: 20000 });
                await page.click('input[type="checkbox"], button');
                await page.waitForTimeout(8000); // 等待验证通过
            } catch (cfErr) {
                await sendToTelegram('❌ Cloudflare 验证处理失败，请人工干预');
            }
        }

        // ✅ 登录逻辑
        await page.waitForSelector('input[name="email"]', { timeout: 20000 });
        await page.type('input[name="email"]', LOGIN_USERNAME, { delay: 100 });
        await page.type('input[name="password"]', LOGIN_PASSWORD, { delay: 100 });
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        // ✅ 登录后截图
        const screenshotPath = '/tmp/login-result.png';
        await page.screenshot({ path: screenshotPath, fullPage: true });

        await sendToTelegram('✅ 登录成功，以下为截图：', screenshotPath);
    } catch (error) {
        console.error('登录过程出错:', error);
        await sendToTelegram(`❌ 登录失败，错误信息:\n${error.message}`);
    } finally {
        await browser.close();
    }
})();
