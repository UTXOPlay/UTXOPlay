// Run after `npm run build` against a store or Vite preview with its API proxy.
// PLAYWRIGHT_ENTRY and CHROMIUM_PATH may point to an existing test installation.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_ENTRY || 'playwright');
const base=process.env.STORE_URL || 'http://127.0.0.1:18836';
const output=process.env.OUTPUT_DIR || '/tmp/store-discovery-checks';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const errors=[], results=[];
try {
 const context=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
 const page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base,{waitUntil:'networkidle'});
 const cards=page.locator('.game-card'), first=cards.first();
 await first.waitFor();
 const total=await cards.count();assert.ok(total>=14);
 const initial=await page.locator('.hero h2').innerText(), titles=[initial];
 for(let i=1;i<total;i++){
  await page.getByRole('button',{name:'Next featured game',exact:true}).click();
  titles.push(await page.locator('.hero h2').innerText());
 }
 assert.equal(new Set(titles).size,total,'one full deck without duplicates');
 await page.getByRole('button',{name:'Next featured game',exact:true}).click();
 assert.notEqual(await page.locator('.hero h2').innerText(),titles.at(-1));
 const beforeReload=await page.locator('.hero h2').innerText();
 await page.reload({waitUntil:'networkidle'});
 assert.notEqual(await page.locator('.hero h2').innerText(),beforeReload,'refresh does not repeat last hero');
 const selected=await page.locator('.hero h2').innerText();
 await page.getByPlaceholder('Search games').fill('botstrike');assert.equal(await cards.count(),1);
 assert.equal(await page.locator('.hero h2').innerText(),selected,'filters do not shuffle the hero');
 await page.getByPlaceholder('Search games').fill('');
 for(const [width,height] of [[1920,1080],[2560,1080],[2560,1440],[3840,2160],[390,844],[844,390]]){
  await page.setViewportSize({width,height});await page.mouse.move(0,0);
  await first.scrollIntoViewIfNeeded();
  const layout=await page.evaluate(()=>{
   const card=document.querySelector('.game-card'), grid=card.parentElement, box=card.getBoundingClientRect();
   return {overflow:document.documentElement.scrollWidth>innerWidth,columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,width:box.width,height:box.height,
    controls:[...document.querySelectorAll('.card-launch')].every(el=>{const r=el.getBoundingClientRect();return r.width>=44 && r.height>=44;})};
  });
  assert.equal(layout.overflow,false,`${width}: no horizontal overflow`);assert.ok(layout.controls);
  assert.ok(layout.height<260,`${width}: compact cards`);
  if(width===390)assert.equal(layout.columns,2);
  if(width>=1920)assert.equal(layout.columns,5);
  results.push({viewportWidth:width,viewportHeight:height,...layout});
 }
 await page.setViewportSize({width:1920,height:1080});
 await first.scrollIntoViewIfNeeded();await page.mouse.move(0,0);
 assert.equal(await page.locator('.is-previewing').count(),0);
 const before=await first.boundingBox();await first.hover();
 await page.waitForFunction(()=>document.querySelectorAll('.is-previewing').length===1);
 assert.deepEqual(await first.boundingBox(),before,'hover does not reflow cards');
 assert.ok(await first.locator('.card-preview').isVisible());
 assert.equal(await first.locator('.credit-byline').count(),0);
 assert.ok(await first.locator('.preview-description').innerText());
 await page.screenshot({path:output+'/desktop-hover.png'});
 await cards.nth(1).hover();
 await page.waitForFunction(()=>document.querySelectorAll('.is-previewing').length===1 && document.querySelectorAll('.game-card')[1].classList.contains('is-previewing'));
 await page.mouse.move(0,0);
 const overview=first.locator('.card-overview');await overview.focus();
 assert.ok(await first.locator('.card-preview').isVisible(),'keyboard focus shows preview');
 await overview.press('Escape');assert.equal(await first.locator('.card-preview').isVisible(),false);
 await overview.press('Enter');
 const modal=page.getByRole('dialog');await modal.waitFor();
 assert.ok(await modal.locator('.game-credits').isVisible(),'full credits remain in details');
 await page.keyboard.press('Escape');assert.equal(await modal.count(),0);
 await page.mouse.move(0,0);await page.locator('.hero-next').focus();await page.evaluate(()=>scrollTo(0,0));
 await page.screenshot({path:output+'/desktop.png'});
 await context.close();
 const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:'reduce'});
 const phone=await touch.newPage();phone.on('pageerror',error=>errors.push(error.message));
 await phone.goto(base,{waitUntil:'networkidle'});
 const card=phone.locator('.game-card.botstrike');await card.locator('.card-overview').tap();
 await phone.getByRole('dialog').waitFor();assert.ok(await phone.getByRole('dialog').locator('.game-credits').isVisible());
 await phone.getByRole('dialog').getByRole('button',{name:'Close BotStrike details',exact:true}).tap();
 assert.equal(await phone.locator('.is-previewing').count(),0,'touch has no sticky hover');
 await phone.locator('.game-card').first().evaluate(el=>el.scrollIntoView({block:'start'}));
 await phone.evaluate(()=>scrollBy(0,-90));
 await phone.screenshot({path:output+'/mobile.png'});
 await touch.close();
 assert.deepEqual(errors,[]);
 await writeFile(output+'/acceptance.json',JSON.stringify({base,deckSize:total,randomizedCycle:true,refreshAvoidsRepeat:true,hoverFocusTouch:true,errors,layouts:results},null,2)+'\n');
 console.log(JSON.stringify({ok:true,base,deckSize:total,layouts:results}));
} finally { await browser.close(); }
