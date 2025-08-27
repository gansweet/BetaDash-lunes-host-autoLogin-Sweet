import puppeteer from 'puppeteer';
import fs from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const LOGIN_URL = process.env.LOGIN_URL || 'https://betadash.lunes.host/login';
const USERNAME = process.env.LUNES_USERNAME;
const PASSWORD = process.env.LUNES_PASSWORD;

async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: text,
            parse_mode: 'Markdown'
        })
    });
}

async function sendTelegramPhoto(filePath, caption = '') {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('photo', fs.createReadStream(filePath));
    formData.append('caption', caption);

    await fetch(url, { method: 'POST', body: formData });
}

(async () => {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.goto(LOGIN_URL, { waitUntil: 'networkidle2' });

        await page.type('input[placeholder="username"]', USERNAME);
        await page.type('input[placeholder="password"]', PASSWORD);
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);

        const currentUrl = page.url();
        if (currentUrl.includes('/dashboard')) {
            await sendTelegramMessage(`✅ 登录成功: ${currentUrl}`);
        } else {
            throw new Error('登录失败，未进入 Dashboard 页面');
        }

    } catch (error) {
        console.error('登录过程出错:', error.message);

        const screenshotPath = 'login-error.png';
        if (browser) {
            const pages = await browser.pages();
            if (pages.length > 0) {
                await pages[0].screenshot({ path: screenshotPath, fullPage: true });
                await sendTelegramPhoto(screenshotPath, `❌ 登录失败，错误信息:\n${error.message}`);
            }
        } else {
            await sendTelegramMessage(`❌ 登录失败，无法截图，错误信息:\n${error.message}`);
        }

        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
})();
