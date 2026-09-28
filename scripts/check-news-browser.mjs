// Browser QA: pass Playwright module path and optional local/live base URL.
import assert from 'node:assert/strict';
const {chromium}=await import(process.argv[2]||'playwright');
const base=process.argv[3]||'http://127.0.0.1:8004/';
const browser=await chromium.launch();
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,1381,1024,768,390,320]){
  await page.setViewportSize({width,height:1000});
  for(const route of ['', 'aktuelles/', 'aktuelles/schankanlage-buergerhaus-urbar.html']){
   await page.goto(base+route);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' overflow '+width);
   if(route==='aktuelles/')assert.equal(await page.locator('.news-card:visible').count(),3);
   if(width===1440||width===390)await page.screenshot({path:'/private/tmp/news-'+(route?route.includes('.html')?'article':'overview':'home')+'-'+width+'.png',fullPage:true});
  }
 }
 await page.goto(base+'aktuelles/?ort=urbar');assert.equal(await page.locator('.news-card:visible').count(),1);
 await page.locator('#news-area').selectOption('vg');assert.equal(await page.locator('.news-card:visible').count(),2);assert.ok(page.url().includes('ort=vg'));
 await page.goBack();assert.equal(await page.locator('#news-area').inputValue(),'urbar');assert.equal(await page.locator('.news-card:visible').count(),1);
 for(const area of ['vallendar','niederwerth','weitersburg']){await page.locator('#news-area').selectOption(area);assert.equal(await page.locator('.news-card:visible').count(),0);assert.ok(await page.locator('#news-empty').isVisible());}
 await page.goto(base+'aktuelles/?ort=ungueltig');assert.equal(await page.locator('.news-card:visible').count(),3);
 for(const slug of ['schankanlage-buergerhaus-urbar','vorstand-gemeindeverband','gremienwegweiser']){await page.goto(base+'aktuelles/'+slug+'.html');assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex,nofollow');}
 const nojs=await browser.newContext({javaScriptEnabled:false});const staticPage=await nojs.newPage();await staticPage.goto(base+'aktuelles/');assert.equal(await staticPage.locator('.news-card:visible').count(),3);await nojs.close();
 assert.deepEqual(errors,[]);console.log('PASS news: six widths, three articles, filters, empty states, URL/history, no-JS, no console errors');
}finally{await browser.close();}
