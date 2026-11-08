const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const path=require('path');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext(); const page=await context.newPage();
 const root=(process.env.SITE_URL||'http://127.0.0.1:4173/').replace(/\/?$/,'/');
 const errors=[],validationErrors=[],outbound=[],requests=[]; let mode='ok';
 page.on('console',message=>{if(message.type()==='error'&&message.text().includes('not focusable'))validationErrors.push(message.text())});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith(new URL(root).origin+'/'))outbound.push(r.url())});
 const check=async(name,fn)=>{if(!await fn())throw Error(name);console.log('PASS '+name)};
 await page.route('https://openrouter.ai/api/v1/chat/completions',async route=>{
  const req=route.request();if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type'}});return;}
  requests.push({body:req.postDataJSON(),headers:req.headers()});
  const headers={'access-control-allow-origin':'*','content-type':'application/json'};
  if(mode==='unauthorized')return route.fulfill({status:401,headers,body:JSON.stringify({error:{message:'SECRET PROVIDER ERROR sk-test-only'}})});
  if(mode==='slow'){await new Promise(r=>setTimeout(r,1200));}
  await route.fulfill({status:200,headers,body:JSON.stringify({choices:[{message:{content:'One idea at a time. <img src=x onerror="window.pwned=1"> sk-test-only'}}]})}).catch(()=>{});
 });
 await page.goto(root);
 await check('homepage embeds scrollable learning history',()=>page.locator('.doc-scroll').evaluate(e=>e.scrollHeight>e.clientHeight));
 await page.locator('.plan summary').click();await check('plan expands',()=>page.locator('.plan').evaluate(e=>e.open));
 await page.locator('#sample-answer').fill('<img src=x onerror="window.pwned=1">');await page.locator('#sample-form button').click();
 await check('scripted feedback remains honest and text-safe',()=>page.locator('#response').innerText().then(t=>t.includes('NOT A GRADE')));
 await page.locator('#reset').click();await check('scripted reset',()=>page.locator('#sample-answer').inputValue().then(v=>v===''));
 await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:path.join(__dirname,'home-desktop.png'),fullPage:true});
 await page.locator('.hero .button').click();await check('live demo separate path',()=>page.url()===root+'demo/');
 await check('no pre-consent provider requests',()=>requests.length===0);
 await page.locator('#material-next').click();await check('empty material rejected',()=>page.locator('[data-step="0"]').isVisible());
 await page.locator('#material').fill('First line');await page.locator('#material').press('End');await page.locator('#material').press('Enter');
 await check('material Enter preserves multiline without advancing',async()=>await page.locator('[data-step="0"]').isVisible()&&(await page.locator('#material').inputValue()).includes('\n')&&requests.length===0);
 await page.locator('#material-next').press('Enter');await page.locator('#goal').fill('Keyboard goal');await page.locator('#goal').press('Enter');
 await check('goal Enter advances to model without hidden validation errors',async()=>await page.locator('[data-step="2"]').isVisible()&&validationErrors.length===0&&requests.length===0);
 await check('only active step controls participate in validation',()=>page.evaluate(()=>[...document.querySelectorAll('.onboard-step')].every(step=>[...step.querySelectorAll('input,textarea,select,button')].every(control=>control.disabled===step.hidden))));
 await page.locator('[data-step="2"] .back').click();
 await check('Back restores goal controls and disables hidden key fields',async()=>await page.locator('#goal').isEnabled()&&await page.locator('#api-key').isDisabled()&&await page.locator('#consent').isDisabled());
 await page.locator('[data-step="1"] .back').click();
 async function setup(){
  await page.locator('#material').fill('Velocity includes direction. <script>window.pwned=1</script>');
  await page.locator('#material-next').click();await page.locator('#goal').fill('Help me understand.');await page.locator('#goal-next').click();
  await page.locator('#api-key').fill('sk-test-only');
 }
 await setup();
 const validModel=await page.locator('#model').inputValue();
 await page.locator('#model').fill('vendor/sk-test-only');await page.locator('#consent').check();
 await page.locator('#onboarding button[type=submit]').click();
 await check('candidate key in model rejected before request or rendering',async()=>requests.length===0&&await page.locator('#onboarding').isVisible()&&await page.locator('#notice').innerText().then(t=>t.includes('Remove your API key'))&&await page.evaluate(()=>document.querySelector('#history').childElementCount===0&&document.querySelector('#session-model').textContent===''));
 await page.locator('#model').fill(validModel);await page.locator('#consent').uncheck();
 await page.locator('#onboarding button[type=submit]').click();await check('consent is mandatory',()=>requests.length===0);
 await page.locator('#consent').check();await page.locator('#api-key').press('Enter');await page.waitForFunction(()=>document.querySelector('#notice').textContent.startsWith('Response added'));
 await check('final-step Enter starts only the consented session',()=>requests.length===1);
 await check('exactly one explicit request',()=>requests.length===1);
 await check('key only in authorization; privacy routing explicit',()=>{const r=requests[0];return r.headers.authorization==='Bearer sk-test-only'&&!JSON.stringify(r.body).includes('sk-test-only')&&r.body.provider.data_collection==='deny'&&r.body.provider.allow_fallbacks===false&&r.body.max_tokens===1200&&!r.headers.cookie});
 await check('no executable model or material HTML; key redacted',()=>page.evaluate(()=>!window.pwned&&!document.querySelector('#history img')&&!document.querySelector('#history script')&&!document.querySelector('#history').textContent.includes('sk-test-only')));
 await check('key input cleared after start',()=>page.locator('#api-key').inputValue().then(v=>v===''));
 await page.locator('#answer').fill('My API key is sk-test-only');await page.locator('#answer-form button').click();await check('key cannot enter followup transcript',()=>requests.length===1);
 mode='unauthorized';await page.locator('#answer').fill('Direction changes.');await page.locator('#answer-form button').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.startsWith('Key rejected'));
 await check('provider errors do not leak raw body',()=>page.locator('body').innerText().then(t=>!t.includes('SECRET PROVIDER ERROR')));
 await page.waitForTimeout(200);await check('no automatic retries',()=>requests.length===2);
 mode='slow';await page.locator('#answer').fill('Stop this request.');await page.locator('#answer').press('End');await page.locator('#answer').press('Enter');
 await check('answer Enter preserves multiline without sending',async()=>(await page.locator('#answer').inputValue()).includes('\n')&&requests.length===2);
 const stoppedRequest=page.waitForRequest(r=>r.method()==='POST'&&r.url()==='https://openrouter.ai/api/v1/chat/completions');
 await page.locator('#answer-form button').click();await stoppedRequest;
 const historyBeforeStop=await page.locator('#history').innerText();
 await page.locator('#cancel').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.startsWith('Request stopped.'));
 await check('Stop restores answer controls and warns of possible charges',async()=>await page.locator('#answer').isEnabled()&&await page.locator('#answer-form button').isEnabled()&&await page.locator('#cancel').isHidden()&&await page.locator('#notice').innerText().then(t=>t.includes('may still charge')));
 await page.waitForTimeout(1400);
 await check('Stop ignores delayed mocked response without retry',async()=>(await page.locator('#history').innerText())===historyBeforeStop&&requests.length===3&&await page.locator('#history').getAttribute('aria-busy').then(v=>v==='false'));
 mode='slow';await page.locator('#answer').fill('Explain again.');await page.locator('#answer-form button').click();await page.locator('#clear').click();await page.waitForTimeout(1400);
 await check('clear cancels and prevents late responses',()=>page.evaluate(()=>document.querySelector('#history').childElementCount===0&&document.querySelector('#material').value===''&&document.querySelector('#api-key').value===''&&!document.querySelector('#consent').checked));
 mode='ok';await setup();await page.locator('#consent').check();await page.locator('#onboarding button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.startsWith('Response added'));
 await page.reload();await check('reload clears session and key',()=>page.evaluate(()=>document.querySelector('#session').hidden&&document.querySelector('#api-key').value===''&&document.querySelector('#history').childElementCount===0));
 await check('no cookies or web storage',()=>page.evaluate(async()=>localStorage.length===0&&sessionStorage.length===0&&document.cookie===''&&(await indexedDB.databases()).length===0&&(await caches.keys()).length===0));
 for(const route of [root,root+'demo/']){
  await page.goto(route);
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});await check('no horizontal overflow '+route+' '+width,()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 }
 await setup();await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:path.join(__dirname,'desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'mobile.png'),fullPage:true});
 await check('only allowed provider contacted',()=>outbound.every(u=>u==='https://openrouter.ai/api/v1/chat/completions'));
 await check('no unfocusable native validation errors',()=>validationErrors.length===0);
 await check('no JavaScript errors',()=>errors.length===0);
 console.log('Model requests were intercepted fixtures; no paid calls.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
