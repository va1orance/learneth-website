const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/root/valorance-preview-tools/node_modules/playwright');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const root = process.env.SITE_URL || 'http://127.0.0.1:4186/';
async function visit(run, options = {}, suffix = '') {
  const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
  try {
    const page = await browser.newPage(options);
    const errors = [], outbound = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).origin !== new URL(root).origin) outbound.push(request.url()); });
    await page.goto(root + suffix);
    await run(page);
    assert.deepEqual(errors, [], 'no JavaScript errors');
    assert.deepEqual(outbound, [], 'no external or paid requests');
  } finally { await browser.close(); }
}
test('headline types and deletes all four words without changing its reserved width', async () => {
  await visit(async page => {
    await page.clock.install();
    await page.reload();
    const samples = [];
    for (let i = 0; i < 260; i++) {
      samples.push(await page.locator('.rotating-word').evaluate(e => ({text:e.textContent,width:e.getBoundingClientRect().width})));
      await page.clock.runFor(80);
    }
    assert.ok(samples.some(s => s.text === 'textbook'), 'deletes individual characters');
    for (const word of ['textbooks','documents','notes','learning']) assert.ok(samples.some(s => s.text === word), word);
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
  }, {reducedMotion:'reduce'});
});
test('fullscreen example deep link keeps plan, answer and reset interactive, with keyboard close', async () => {
  await visit(async page => {
    const dialog = page.getByRole('dialog', {name:'Example session — scripted, not live AI'});
    assert.equal(await dialog.count(), 1, 'deep link opens the example dialog');
    assert.ok(await dialog.isVisible());
    assert.equal(await page.locator('.workspace').count(), 1, 'reuse the original example');
    for (const width of [1440, 390]) {
      await page.setViewportSize({width,height:844});
      const box = await dialog.boundingBox();
      assert.ok(box.width >= width - 2 && box.height >= 842, 'fills the viewport');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.locator('.plan summary').click();
    assert.ok(await page.locator('.plan').evaluate(e => e.open));
    await page.locator('#sample-answer').fill('<img src=x onerror="window.pwned=1"> Direction changes.');
    await page.locator('#sample-form button').click();
    assert.match(await page.locator('#response').innerText(), /NOT A GRADE/);
    assert.equal(await page.locator('#response img').count(), 0);
    await page.locator('#reset').click();
    assert.equal(await page.locator('#sample-answer').inputValue(), '');
    await page.keyboard.press('Escape');
    assert.ok(!await dialog.isVisible());
    await page.waitForURL(url => !url.searchParams.has('example'));
    assert.equal(new URL(page.url()).searchParams.has('example'), false);
    await page.getByRole('button', {name:'Open example fullscreen'}).click();
    assert.ok(await dialog.isVisible());
    await page.getByRole('button', {name:'Close example'}).click();
    assert.ok(!await dialog.isVisible());
    await page.locator('#preview > .workspace').waitFor();
    assert.ok(await page.locator('#preview > .workspace').count());
    assert.ok(await page.getByRole('button', {name:'Open example fullscreen'}).evaluate(e => e === document.activeElement));
  }, {}, '?example=fullscreen#preview');
});
test('hash-only entry opens fullscreen and preserves the embedded session state', async () => {
  await visit(async page => {
    await page.locator('.plan summary').click();
    await page.locator('#sample-answer').fill('My unfinished answer');
    await page.evaluate(() => { location.hash = 'example-fullscreen'; });
    await page.waitForFunction(() => document.querySelector('#example-fullscreen').open);
    assert.equal(await page.locator('#sample-answer').inputValue(), 'My unfinished answer');
    assert.ok(await page.locator('.plan').evaluate(e => e.open));
    await page.getByRole('button', {name:'Close example'}).click();
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
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(() => document.querySelector('.type-text').textContent === 'textbooks');
    await page.clock.runFor(5000);
    assert.equal(await page.locator('.type-text').innerText(), 'textbooks');
    await page.emulateMedia({reducedMotion:'no-preference'});
    // MediaQueryList change is delivered on a real rendering frame, outside the mocked clock.
    await new Promise(resolve => setTimeout(resolve, 100));
    await page.clock.runFor(1900);
    assert.notEqual(await page.locator('.type-text').innerText(), 'textbooks');
  });
});
test('only the first hero Try it out action is removed', async () => {
  await visit(async page => {
    assert.equal(await page.locator('.hero .try-link').count(), 0);
    assert.equal(await page.locator('.preview-try[href="demo/"]').count(), 1);
    assert.equal(await page.locator('h1 u').innerText(), 'active');
  });
});
