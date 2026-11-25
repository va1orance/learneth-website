const assert = require('node:assert/strict');
const { test } = require('node:test');
const { WORKER_ORIGIN, getRootUrl, launchChromium, stubWorker, waitForFeedbackSettled } = require('./pw-helper.cjs');

const root = getRootUrl();

async function visit(run, options = {}, suffix = '', workerHandler = null) {
  const browser = await launchChromium();
  try {
    const { onWorker, ...contextOptions } = options;
    const page = await browser.newPage(contextOptions);
    const errors = [], outbound = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = request.url();
      if (new URL(url).origin !== new URL(root).origin && !url.startsWith(WORKER_ORIGIN)) {
        outbound.push(url);
      }
    });
    await stubWorker(page, workerHandler || onWorker);
    await page.goto(root + suffix);
    await run(page);
    assert.deepEqual(errors, [], 'no JavaScript errors');
    assert.deepEqual(outbound, [], 'no external or paid requests');
  } finally {
    await browser.close();
  }
}

test('headline types and deletes all four words without changing its reserved width', async () => {
  await visit(async page => {
    await page.clock.install();
    await page.reload();
    const samples = [];
    for (let i = 0; i < 260; i++) {
      samples.push(await page.locator('.rotating-word').evaluate(e => ({ text: e.textContent, width: e.getBoundingClientRect().width })));
      await page.clock.runFor(80);
    }
    assert.ok(samples.some(s => s.text === 'textbook'), 'deletes individual characters');
    for (const word of ['textbooks', 'documents', 'notes', 'learning']) assert.ok(samples.some(s => s.text === word), word);
    assert.ok(samples.some(s => s.text === 'doc'), 'types individual characters');
    assert.ok(samples.every(s => Math.abs(s.width - samples[0].width) < 1), 'stable width');
    const caret = page.locator('.type-caret');
    assert.equal(await caret.count(), 1);
    assert.notEqual(await caret.evaluate(e => getComputedStyle(e).animationName), 'none');
  });
});

test('reduced motion keeps a complete static word and nonblinking cursor', async () => {
  await visit(async page => {
    await page.clock.install(); await page.reload(); await page.clock.runFor(20000);
    assert.equal(await page.locator('.rotating-word').innerText(), 'textbooks');
    assert.equal(await page.locator('.type-caret').evaluate(e => getComputedStyle(e).animationName), 'none');
  }, { reducedMotion: 'reduce' });
});

test('fullscreen example deep link keeps plan, answer and reset interactive, with keyboard close', async () => {
  await visit(async page => {
    const dialog = page.getByRole('dialog', { name: 'Example session — scripted, not live AI' });
    assert.equal(await dialog.count(), 1, 'deep link opens the example dialog');
    assert.ok(await dialog.isVisible());
    assert.equal(await page.locator('.workspace').count(), 1, 'reuse the original example');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const box = await dialog.boundingBox();
      assert.ok(box.width >= width - 2 && box.height >= 842, 'fills the viewport');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    if (await page.locator('#skip-script').isVisible()) await page.locator('#skip-script').click();
    await page.locator('.plan summary').click();
    assert.ok(await page.locator('.plan').evaluate(e => e.open));
    await page.locator('#sample-answer').fill('<img src=x onerror="window.pwned=1"> Direction changes.');
    await page.locator('#sample-form button[type="submit"]').click();
    await waitForFeedbackSettled(page);
    assert.match(await page.locator('#response').innerText(), /THAT’S THE KEY/);
    assert.equal(await page.locator('#response img').count(), 0);
    await page.locator('#reset').click();
    assert.equal(await page.locator('#sample-answer').inputValue(), '');
    await page.keyboard.press('Escape');
    assert.ok(!await dialog.isVisible());
    await page.waitForURL(url => !url.searchParams.has('example'));
    assert.equal(new URL(page.url()).searchParams.has('example'), false);
    await page.getByRole('button', { name: 'Open example fullscreen' }).click();
    assert.ok(await dialog.isVisible());
    await page.getByRole('button', { name: 'Close example' }).click();
    assert.ok(!await dialog.isVisible());
    await page.locator('#preview > .workspace').waitFor();
    assert.ok(await page.locator('#preview > .workspace').count());
    assert.ok(await page.getByRole('button', { name: 'Open example fullscreen' }).evaluate(e => e === document.activeElement));
  }, {}, '?example=fullscreen#preview');
});

test('hash-only entry opens fullscreen and preserves the embedded session state', async () => {
  await visit(async page => {
    if (await page.locator('#page-skip').isVisible()) await page.locator('#page-skip').click();
    if (await page.locator('#skip-script').isVisible()) await page.locator('#skip-script').click();
    await page.locator('.plan summary').click();
    await page.locator('#sample-answer').fill('My unfinished answer');
    await page.evaluate(() => { location.hash = 'example-fullscreen'; });
    await page.waitForFunction(() => document.querySelector('#example-fullscreen').open);
    assert.equal(await page.locator('#sample-answer').inputValue(), 'My unfinished answer');
    assert.ok(await page.locator('.plan').evaluate(e => e.open));
    await page.getByRole('button', { name: 'Close example' }).click();
    await page.locator('#preview > .workspace').waitFor();
    assert.equal(new URL(page.url()).hash, '#preview');
    assert.equal(await page.locator('#sample-answer').inputValue(), 'My unfinished answer');
  });
});

test('motion preference changes stop and restart typing safely', async () => {
  await visit(async page => {
    await page.clock.install(); await page.reload();
    await page.clock.runFor(1900);
    assert.notEqual(await page.locator('.type-text').innerText(), 'textbooks');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (let i = 0; i < 40; i++) {
      if ((await page.locator('.type-text').innerText()) === 'textbooks') break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(await page.locator('.type-text').innerText(), 'textbooks');
    await page.clock.runFor(5000);
    assert.equal(await page.locator('.type-text').innerText(), 'textbooks');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // MediaQueryList change is delivered on a real rendering frame, outside the mocked clock.
    await new Promise(resolve => setTimeout(resolve, 100));
    await page.clock.runFor(1900);
    assert.notEqual(await page.locator('.type-text').innerText(), 'textbooks');
  });
});

test('sample form shows 429 busy note on fallback and renders mocked live reply safely', async () => {
  let mode = '429';
  await visit(async page => {
    await page.locator('#sample-answer').fill('Maybe because you lean?');
    await page.locator('#sample-form button[type="submit"]').click();
    await waitForFeedbackSettled(page);
    assert.match(await page.locator('#response').innerText(), /NOT A GRADE/);
    assert.match(await page.locator('#sample-mode-note').innerText(), /temporarily busy \(429\)/);
    await page.locator('#reset').click();
    assert.doesNotMatch(await page.locator('#sample-mode-note').innerText(), /429/);

    mode = '200';
    await page.evaluate(() => {
      window.__liveStates = [];
      const resp = document.querySelector('#response');
      new MutationObserver(() => {
        const p = resp.querySelector('.feedback p');
        if (p && p.textContent) window.__liveStates.push(resp.getAttribute('aria-live'));
      }).observe(resp, { childList: true, subtree: true, characterData: true });
    });
    await page.locator('#sample-answer').fill('Direction changes continuously.');
    await page.locator('#sample-form button[type="submit"]').click();
    await waitForFeedbackSettled(page);
    const resp = await page.locator('#response').innerText();
    assert.match(resp, /FREE DEMO MODEL/);
    assert.match(resp, /Mocked inward acceleration hint/);
    assert.equal(await page.locator('#response').getAttribute('aria-live'), 'polite');
    assert.deepEqual(await page.evaluate(() => window.__liveStates), ['polite']);

    await page.locator('.checkin-chip[data-q="files"]').click();
    assert.equal(await page.locator('#checkin-reply').getAttribute('aria-live'), 'polite');
    assert.match(await page.locator('#checkin-reply').innerText(), /Never touched/);
  }, { reducedMotion: 'reduce' }, '', async route => {
    if (mode === '429') {
      await route.fulfill({
        status: 429,
        headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'Rate limit' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, heading: 'Good direction insight.', body: 'Mocked inward acceleration hint.' }),
    });
  });
});

test('page-skip clears mid-flight section thinking state cleanly', async () => {
  await visit(async page => {
    await page.locator('#preview').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('#preview .section-think.is-thinking') !== null);
    await page.locator('#page-skip').click();
    assert.equal(await page.locator('.section-think.is-thinking').count(), 0);
    assert.equal(await page.locator('#preview .section-think.is-done').count(), 1);
    assert.equal(await page.locator('#preview .section-think-text').innerText(), 'Section 01 · Live workspace example');
    assert.equal(await page.locator('#preview .section-think .think-spin').innerText(), '✓');
  });
});

test('only the first hero Try it out action is removed, mobile CTA stays visible without overflow, and aria-live excludes timers', async () => {
  await visit(async page => {
    assert.equal(await page.locator('.hero .try-link').count(), 0);
    assert.equal(await page.locator('.try-link[href="demo/"]').count(), 1);
    assert.equal(await page.locator('h1 u').innerText(), 'active');
    assert.equal(await page.locator('#page-thinking').getAttribute('aria-live'), null);
    assert.equal(await page.locator('#tutor-thinking').getAttribute('aria-live'), null);
    assert.equal(await page.locator('#response').getAttribute('aria-live'), 'polite');

    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('.site-header .nav-cta').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('.theme-btn[data-theme-choice="light"]').click();
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'light');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
});
