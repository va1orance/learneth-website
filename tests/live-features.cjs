const assert = require('node:assert/strict');
const { getRootUrl, launchChromium, stubWorker } = require('./pw-helper.cjs');

(async () => {
  const browser = await launchChromium();
  try {
    const page = await browser.newPage();
    const requests = [];
    let responseMode = 'ok';
    const site = getRootUrl();
    await stubWorker(page, async (route, req) => {
      requests.push({ url: req.url(), body: req.postDataJSON(), headers: req.headers() });
      await route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
        body: JSON.stringify({ ok: true, model: 'google/gemma-3-27b-it:free', body: 'Free demo follow-up reply.' }),
      });
    });
    await page.route('https://**/*', async route => {
      const r = route.request();
      if (new URL(r.url()).origin === new URL(site).origin) return route.continue();
      if (r.url().startsWith('https://learneth-example-proxy.va1orance.workers.dev')) return route.fallback();
      requests.push({ url: r.url(), body: r.postDataJSON(), headers: r.headers() });
      if (responseMode === 'slow') {
        await new Promise(r => setTimeout(r, 800));
      }
      if (responseMode === '401') {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'bad key' } }),
        });
        return;
      }
      if (responseMode === 'array') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            choices: [{ message: { content: ['Array chunk one. ', { text: 'Array chunk two.' }] } }],
          }),
        });
        return;
      }
      if (responseMode === 'rich-sse') {
        const sse = [
          'data: ' + JSON.stringify({ choices: [{ delta: { reasoning: 'Checking force decomposition...' } }] }),
          'data: ' + JSON.stringify({ choices: [{ delta: { content: '### Forces breakdown\n\n```mermaid\ngraph TD\nA[Weight] --> B[Parallel mg sin theta]\nA --> C[Normal]\n```\n\n```learneth-chart\n{"title":"Sample Scores","type":"bar","labels":["Try 1","Try 2"],"values":[40,85]}\n```\n\n| Term | Meaning |\n| --- | --- |\n| N | Normal force |' } }] }),
          'data: [DONE]',
        ].join('\n\n') + '\n\n';
        await route.fulfill({
          status: 200,
          headers: { 'access-control-allow-origin': '*', 'content-type': 'text/event-stream' },
          body: sse,
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message: { content: 'Safe teaching response' } }] }),
      });
    });

    await page.goto(site + 'demo/');
    assert.equal(await page.locator('h1').innerText(), 'Try Learneth');
    assert.equal(await page.locator('#welcome').evaluate(e => e.open), true);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('[data-step="1"] input, [data-step="2"] input')].every(i => i.disabled)), true);

    await page.locator('#welcome-close').focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'example-choice');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement.id === 'reopen-welcome');
    assert.equal(await page.locator('#welcome').evaluate(e => e.open), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'reopen-welcome');

    await page.locator('#reopen-welcome').click();
    await page.locator('#live-choice').click();
    assert.equal(await page.locator('#material').isVisible(), true);
    await page.waitForFunction(() => document.activeElement.matches('[data-step="0"] h2'));
    assert.equal(await page.locator('#example-choice').getAttribute('href'), '../?example=fullscreen#preview');
    assert.equal(requests.length, 0);
    console.log('PASS accessible welcome, dismiss/reopen, boot step disable, live and example paths');
    if (process.env.SLICE === 'welcome') return;

    await page.locator('#upload').setInputFiles({ name: 'notes.md', mimeType: 'text/markdown', buffer: Buffer.from('Velocity includes direction.') });
    await page.waitForFunction(() => document.querySelector('#material').value === 'Velocity includes direction.');
    await page.locator('#material').fill('');
    await page.locator('#upload').setInputFiles({ name: 'notes.md', mimeType: 'text/markdown', buffer: Buffer.from('Velocity includes direction.') });
    await page.waitForFunction(() => document.querySelector('#material').value === 'Velocity includes direction.');
    await page.locator('#upload').setInputFiles({ name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF invalid') });
    await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('Unsupported'));
    assert.equal(await page.locator('#material').inputValue(), 'Velocity includes direction.');
    await page.locator('#upload').setInputFiles({ name: 'large.txt', mimeType: 'text/plain', buffer: Buffer.alloc(65537, 65) });
    await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('64 KiB'));
    console.log('PASS local Markdown upload, same-file re-upload, unsupported PDF rejection and file limit');
    if (process.env.SLICE === 'upload') return;

    await page.locator('#material-next').click();
    await page.locator('input[value="custom"]').check();
    await page.locator('#goal-next').click();
    assert.equal(await page.locator('[data-step="1"]').isVisible(), true);
    await page.locator('input[value="only"]').check();
    await page.locator('#goal-next').click();
    assert.equal(await page.locator('[data-step="2"]').isVisible(), true);

    // Turn-0 failure disables follow-up form until an assistant reply exists; Turn-0 Stop focuses #retry-turn.
    responseMode = '401';
    await page.locator('#base-url').fill('https://compatible.example/v1');
    await page.locator('#api-key').fill('sk-bad-key');
    await page.locator('#consent').check();
    await page.locator('#onboarding button[type=submit]').click();
    await page.waitForFunction(() => document.querySelector('#notice').textContent.startsWith('Key rejected'));
    assert.equal(await page.locator('#recovery-bar').isVisible(), true);
    assert.equal(await page.locator('#answer').isDisabled(), true);
    assert.equal(await page.locator('#answer-form button').isDisabled(), true);

    responseMode = 'slow';
    const slowTurn0 = page.waitForRequest(r => r.url() === 'https://compatible.example/v1/chat/completions');
    await page.locator('#retry-turn').click();
    await slowTurn0;
    await page.locator('#cancel').click();
    await page.waitForFunction(() => document.querySelector('#notice').textContent.startsWith('Request stopped.'));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'retry-turn');
    assert.equal(await page.locator('#recovery-bar').isVisible(), true);
    assert.equal(await page.locator('#answer').isDisabled(), true);

    await page.locator('#edit-model').click();
    assert.equal(await page.locator('[data-step="2"]').isVisible(), true);
    assert.equal(await page.locator('#api-key').inputValue(), '');
    assert.equal(await page.locator('#consent').isChecked(), false);

    responseMode = 'array';
    await page.locator('#api-key').fill('sk-test-only');
    await page.locator('#consent').check();
    await page.locator('#onboarding button[type=submit]').click();
    await page.waitForFunction(() => document.querySelector('#notice').textContent.startsWith('Response added'));
    assert.equal(await page.locator('#answer').isEnabled(), true);
    assert.equal(await page.locator('#history h3', { hasText: 'YOUR MATERIAL' }).count(), 1);
    assert.match(await page.locator('#history').innerText(), /Array chunk one\. Array chunk two\./);
    const turn0Req = requests.at(-1);
    assert.equal(turn0Req.url, 'https://compatible.example/v1/chat/completions');
    assert.match(turn0Req.body.messages[0].content, /only.*material/i);
    assert.match(turn0Req.body.messages[0].content, /untrusted/i);
    assert.equal(turn0Req.headers.authorization, 'Bearer sk-test-only');
    assert.equal(JSON.stringify(turn0Req.body).includes('sk-test-only'), false);
    console.log('PASS turn-0 non-destructive recovery, answer-guard, array message.content, and material-only policy');

    // Follow-up failure + manual Retry turn does not duplicate or orphan user turns.
    responseMode = '401';
    await page.locator('#answer').fill('Follow-up reasoning.');
    await page.locator('#answer-form button').click();
    await page.waitForFunction(() => document.querySelector('#notice').textContent.startsWith('Key rejected'));
    assert.equal(await page.locator('#recovery-bar').isVisible(), true);

    responseMode = 'ok';
    await page.locator('#retry-turn').click();
    await page.waitForFunction(() => document.querySelector('#notice').textContent.startsWith('Response added'));
    const sentMessages = requests.at(-1).body.messages;
    assert.equal(sentMessages.filter(m => m.content === 'Follow-up reasoning.').length, 1);
    assert.equal(await page.locator('#history h3', { hasText: /^YOU$/ }).count(), 1);

    // Download .md export (key-redacted).
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download-md').click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'learneth-session.md');
    const mdStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of mdStream) chunks.push(chunk);
    const mdText = Buffer.concat(chunks).toString('utf8');
    assert.match(mdText, /# Learneth Session/);
    assert.match(mdText, /Velocity includes direction\./);
    assert.match(mdText, /Follow-up reasoning\./);
    assert.equal(mdText.includes('sk-test-only'), false);
    // Follow-up failure + Edit model / switch to Free mode + manual Retry turn.
    responseMode = '401';
    await page.locator('#answer').fill('Second follow-up reasoning.');
    await page.locator('#answer-form button').click();
    await page.waitForFunction(() => document.querySelector('#notice').textContent.startsWith('Key rejected'));
    await page.locator('#edit-model').click();
    assert.equal(await page.locator('[data-step="2"]').isVisible(), true);
    await page.locator('input[name="provider-mode"][value="free"]').check();
    assert.equal(await page.locator('#consent').isChecked(), false);
    await page.locator('#consent').check();
    await page.locator('#onboarding button[type=submit]').click();
    await page.waitForFunction(() => document.querySelector('#notice').textContent.startsWith('Connection updated'));
    assert.equal(await page.locator('#history h3', { hasText: 'YOUR MATERIAL' }).count(), 1);
    assert.equal(await page.locator('#recovery-bar').isVisible(), true);
    await page.locator('#retry-turn').click();
    await page.waitForFunction(() => document.querySelector('#notice').textContent.startsWith('Response added'));
    const freeReq = requests.at(-1);
    assert.equal(freeReq.url, 'https://learneth-example-proxy.va1orance.workers.dev/demo');
    assert.equal(freeReq.headers.authorization, undefined);
    assert.equal(freeReq.body.messages.some(m => m.role === 'system'), false);
    assert.match(await page.locator('#history').innerText(), /Free demo follow-up reply\./);
    console.log('PASS follow-up Retry turn, switch-to-free recovery, and key-redacted .md download');
    if (process.env.SLICE === 'endpoint') return;

    assert.equal(await page.locator('#image-form').count(), 0);
    assert.match(await page.locator('#session').innerText(), /Image generation is disabled/);

    responseMode = 'rich-sse';
    await page.locator('#clear').click();
    await page.locator('#material').fill('Forces on an inclined plane.');
    await page.locator('#material-next').click();
    await page.locator('#goal-next').click();
    assert.match(await page.locator('#image-disabled-note').innerText(), /Image generation is disabled/);
    await page.locator('#base-url').fill('https://compatible.example/v1');
    await page.locator('#api-key').fill('sk-test-only');
    await page.locator('#consent').check();
    await page.locator('#onboarding button[type=submit]').click();
    await page.waitForFunction(() => document.querySelector('#notice').textContent.startsWith('Response added'));
    assert.equal(await page.locator('#history details.demo-thinking').count(), 1);
    assert.equal(await page.locator('#history details.demo-thinking').evaluate(d => !d.open), true);
    await page.locator('#history details.demo-thinking summary').click();
    assert.match(await page.locator('#history .demo-thinking-body').innerText(), /Checking force decomposition/);
    assert.equal(await page.locator('#history .demo-diagram svg').count(), 2);
    assert.equal(await page.locator('#history table.demo-table').count(), 1);
    assert.equal(await page.locator('#history script').count(), 0);
    console.log('PASS SSE streaming thinking dropdown, Mermaid flowchart, bar chart, and Markdown table rendering');

    // Verify in-memory Light/Dark toggle and responsive layout at 390/768/1440.
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'light');
    await page.locator('.theme-btn[data-theme-choice="dark"]').click();
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark');
    await page.locator('.theme-btn[data-theme-choice="light"]').click();
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'light');
    assert.equal(await page.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0 && !location.search), true);

    await page.locator('#clear').click();
    await page.locator('#reopen-welcome').click();
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.locator('#welcome').evaluate(e => e.getBoundingClientRect().width <= innerWidth - 20), true);
    }
    assert.equal(await page.locator('#welcome').evaluate(e => getComputedStyle(e).color), await page.locator('body').evaluate(e => getComputedStyle(e).color));
    console.log('PASS responsive modal with inherited theme');
    assert.equal(await page.locator('#live-choice').evaluate(e => e.scrollWidth <= e.clientWidth), true);
    assert.equal(await page.locator('#welcome-close').evaluate(e => e.getBoundingClientRect().right > document.querySelector('#welcome').getBoundingClientRect().right - 65), true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#live-choice').click();
    await page.locator('#material').fill('Notes');
    await page.locator('#material-next').click();
    assert.equal(await page.locator('input[type=radio]').first().evaluate(e => e.getBoundingClientRect().width < 30), true);
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
