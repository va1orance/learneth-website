const fs = require('node:fs');

const WORKER_ORIGIN = 'https://learneth-example-proxy.va1orance.workers.dev';

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    'playwright',
    '/root/valorance-preview-tools/node_modules/playwright',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (err) {
      if (err && err.code !== 'MODULE_NOT_FOUND') throw err;
    }
  }
  throw new Error('Playwright module not found. Set PLAYWRIGHT_MODULE or install playwright.');
}

async function launchChromium(extra = {}) {
  const { chromium } = loadPlaywright();
  const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  return chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
    ...(executablePath ? { executablePath } : {}),
    ...extra,
  });
}

function getRootUrl() {
  return (process.env.SITE_URL || 'http://127.0.0.1:4173/').replace(/\/?$/, '/');
}

async function stubWorker(page, handler) {
  await page.route(`${WORKER_ORIGIN}/**`, async route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': 'content-type',
        },
      });
      return;
    }
    if (handler) {
      await handler(route, req);
      return;
    }
    await route.fulfill({
      status: 503,
      headers: {
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ok: false, error: 'Stubbed offline for test' }),
    });
  });
}

async function waitForFeedbackSettled(page) {
  await page.waitForFunction(() => {
    const label = document.querySelector('#response .feedback-label');
    if (!label) return false;
    const text = label.textContent || '';
    if (text.includes('thinking') || text.includes('writing')) return false;
    return document.querySelectorAll('#response .stream-caret').length === 0;
  });
}

module.exports = {
  WORKER_ORIGIN,
  getRootUrl,
  launchChromium,
  stubWorker,
  waitForFeedbackSettled,
};
