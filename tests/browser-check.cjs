const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('path');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 const errors=[]; const failed=[]; const outbound=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)failed.push(r.url())});
 const root=(process.env.SITE_URL||'http://127.0.0.1:4173/learneth/').replace(/\/?$/,'/');
 page.on('request',r=>{if(!r.url().startsWith(new URL(root).origin+'/'))outbound.push(r.url())});
 const check=async(name,fn)=>{if(!await fn())throw Error(name);console.log('PASS '+name)};
 await page.goto(root);
 await check('information preserved',()=>page.locator('#approach').count().then(n=>n===1));
 await page.locator('.hero .button').click();
 await check('demo is separate route',()=>page.url()===root+'demo/');
 await check('dark background',()=>page.evaluate(()=>getComputedStyle(document.body).backgroundColor==='rgb(25, 25, 24)'));
 await check('document has scrollable history',()=>page.locator('.doc-scroll').evaluate(e=>e.scrollHeight>e.clientHeight));
 await check('plan collapsed initially',()=>page.locator('.plan').evaluate(e=>!e.open));
 await page.locator('.plan summary').click();await check('plan expands',()=>page.locator('.plan').evaluate(e=>e.open));
 await page.locator('.plan summary').click();
 await page.locator('#sample-answer').fill('   ');
 await page.locator('#sample-form button').click();
 await check('whitespace rejected',()=>page.locator('#sample-form').isVisible());
 const payload='<img src=x onerror="window.pwned=true"> Direction changes.';
 await page.locator('#sample-answer').fill(payload);
 await page.locator('#sample-form button').click();
 await check('response appended with honest fixed feedback',()=>page.locator('#response').innerText().then(t=>t.includes(payload)&&t.includes('NOT A GRADE')));
 await check('input is not interpreted as HTML',()=>page.evaluate(()=>!window.pwned&&!document.querySelector('#response img')));
 await page.locator('#reset').click();
 await check('reset restores empty input',()=>page.locator('#sample-answer').inputValue().then(v=>v===''));
 await page.locator('#sample-answer').fill('Direction changes.');await page.locator('#sample-form button').click();await page.reload();
 await check('reload clears private answer',()=>page.locator('#sample-answer').inputValue().then(v=>v===''));
 for(const route of [root,root+'demo/']) {
  await page.goto(route);
  for(const width of [390,768,1440]){
   await page.setViewportSize({width,height:900});
   await check('no horizontal overflow '+route+' at '+width,()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
 }
 await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:path.join(__dirname,'desktop.png')});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'mobile.png')});
 await page.locator('header .wordmark').click();await check('return to information',()=>page.url()===root);
 await check('no browser JS errors',()=>errors.length===0);
 await check('no failed resources',()=>failed.length===0);
 await check('no third party or model requests',()=>outbound.length===0);
 await check('no browser storage',()=>page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0&&document.cookie===''));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
