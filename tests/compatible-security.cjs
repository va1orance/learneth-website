const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/root/valorance-preview-tools/node_modules/playwright');
const assert=require('node:assert/strict');
const root=process.env.SITE_URL||'http://127.0.0.1:4175/';
(async()=>{const browser=await chromium.launch({args:['--no-sandbox']});try{
const page=await browser.newPage();const requests=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('https://**/*',async route=>{
 if(new URL(route.request().url()).origin===new URL(root).origin)return route.continue();
 requests.push({url:route.request().url(),headers:route.request().headers(),body:route.request().postDataJSON()});
 await route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:'Fixture response, not live inference.'}}]})});
});
await page.goto(root+'demo/');await page.locator('#live-choice').click();
await page.locator('#material').fill('A vector has a magnitude and direction.');await page.locator('#material-next').click();
await page.locator('input[name=teaching][value=custom]').check();await page.locator('#goal').fill('Use one small analogy, then ask a question.');await page.locator('#goal-next').click();
await page.locator('#api-key').fill('sk-security-fixture');
for(const endpoint of ['http://api.example/v1','https://user:pass@api.example/v1','https://api.example/v1?key=x','https://api.example/v1#fragment']){
 await page.locator('#base-url').fill(endpoint);await page.locator('#consent').check();await page.locator('#onboarding button[type=submit]').click();assert.equal(requests.length,0,endpoint);
}
await page.locator('#base-url').fill('https://api.example/v1');await page.locator('#consent').check();
await page.locator('#base-url').fill('https://second.example/v1');assert.equal(await page.locator('#consent').isChecked(),false);
assert.equal(requests.length,0,'endpoint change cannot issue request');
await page.locator('#image-model').fill('sk-security-fixture');await page.locator('#consent').check();await page.locator('#onboarding button[type=submit]').click();
assert.equal(requests.length,0,'key duplicated in image model must not leave browser');
await page.locator('#image-model').fill('');await page.locator('#consent').check();await page.locator('#onboarding button[type=submit]').click();
await page.waitForFunction(()=>document.querySelector('#notice').textContent.startsWith('Response added'));
assert.equal(requests.length,1);assert.equal(requests[0].url,'https://second.example/v1/chat/completions');
assert.match(requests[0].body.messages[0].content,/Use one small analogy/);assert.equal(JSON.stringify(requests[0].body).includes('sk-security-fixture'),false);
assert.equal(requests[0].headers.authorization,'Bearer sk-security-fixture');
assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})), '{}');assert.equal(await page.evaluate(()=>JSON.stringify({...sessionStorage})), '{}');assert.deepEqual(await page.context().cookies(),[]);
await page.locator('#answer').fill('sk-security-fixture');await page.locator('#answer-form button').click();assert.equal(requests.length,1,'answer secret guard');
await page.locator('#clear').click();assert.equal(await page.locator('#api-key').inputValue(),'');assert.equal(await page.locator('#history').textContent(),'');
assert.deepEqual(errors,[]);console.log('PASS custom teaching prompt, invalid endpoint rejection, consent reset, image-model/answer key guards, memory-only session and clearing; all model requests intercepted fixtures.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
