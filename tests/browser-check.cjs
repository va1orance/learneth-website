// Optional browser check: use an installed Playwright or set PLAYWRIGHT_MODULE.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SITE_URL||'http://127.0.0.1:14174');
 await page.locator('#preview').scrollIntoViewIfNeeded();
 await page.screenshot({path:require('path').join(__dirname,'desktop.png')});
 const check=async(name,fn)=>{if(!await fn())throw Error(name);console.log('PASS '+name)};
 await check('dark background',()=>page.evaluate(()=>getComputedStyle(document.body).backgroundColor==='rgb(25, 25, 24)'));
 await check('document has scrollable history',()=>page.locator('.doc-scroll').evaluate(e=>e.scrollHeight>e.clientHeight));
 await check('plan collapsed initially',()=>page.locator('.plan').evaluate(e=>!e.open));
 await page.locator('.plan summary').click();await check('plan expands',()=>page.locator('.plan').evaluate(e=>e.open));
 await page.locator('.plan summary').click();await check('plan collapses',()=>page.locator('.plan').evaluate(e=>!e.open));
 await page.locator('#sample-answer').fill('The direction changes, so velocity changes.');
 await page.locator('#sample-form button').click();
 await check('response appended to document',()=>page.locator('#response').innerText().then(t=>t.includes('The direction changes, so velocity changes.')&&t.includes('NOT A GRADE')));
 await page.locator('#reset').click();await check('reset restores input',()=>page.locator('#sample-form').isVisible());
 for(const width of [390,768,1440]){
 await page.setViewportSize({width,height:900});
 await check('no horizontal overflow at '+width,()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await page.setViewportSize({width:390,height:844});await page.locator('#preview').scrollIntoViewIfNeeded();
 await page.screenshot({path:require('path').join(__dirname,'mobile.png')});
 await check('no browser JS errors',()=>errors.length===0);
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
