import {chromium,Page,Locator,BrowserContext} from 'playwright';
import {loadEnvConfig} from '@next/env';

loadEnvConfig(process.cwd());

const BASE='https://fantasy.formula1.com/en/statistics/details';
const app=process.env.PADDOCK_IQ_URL||'http://localhost:3000';
const key=process.env.MARKET_ADMIN_KEY;
if(!key)throw new Error('MARKET_ADMIN_KEY is required');

const DRIVER_CODES:Record<string,string>={
 NORRIS:'NOR',PIASTRI:'PIA',VERSTAPPEN:'VER',RUSSELL:'RUS',HAMILTON:'HAM',LECLERC:'LEC',
 ANTONELLI:'ANT',HADJAR:'HAD',GASLY:'GAS',COLAPINTO:'COL',LAWSON:'LAW',SAINZ:'SAI',
 OCON:'OCO',BORTOLETO:'BOR',LINDBLAD:'LIN',ALONSO:'ALO',ALBON:'ALB',BEARMAN:'BEA',
 HULKENBERG:'HUL',HÜLKENBERG:'HUL',BOTTAS:'BOT',PEREZ:'PER',PÉREZ:'PER',STROLL:'STR'
};
const CONSTRUCTOR_CODES:Record<string,string>={
 'MCLAREN':'MCL','RED BULL':'RBR','RED BULL RACING':'RBR','FERRARI':'FER','MERCEDES':'MER',
 'ASTON MARTIN':'AST','ALPINE':'ALP','HAAS':'HAS','HAAS F1 TEAM':'HAS','WILLIAMS':'WIL',
 'RACING BULLS':'RB','RB':'RB','AUDI':'AUD','AUDI REVOLUT F1 TEAM':'AUD','CADILLAC':'CAD',
 'CADILLAC FORMULA 1 TEAM':'CAD'
};

async function consent(page:Page){
 const frame=page.locator('iframe[title="SP Consent Message"], iframe[id^="sp_message_iframe_"]').first();
 if(await frame.count()){
  const body=frame.contentFrame();
  const essential=body.getByRole('button',{name:/Essential only cookies/i}).or(body.getByText(/Essential only cookies/i)).first();
  await essential.click({timeout:5000}).catch(async()=>{
   const anyButton=body.locator('button').filter({hasText:/Essential|Reject|Necessary/i}).first();
   await anyButton.click({timeout:3000}).catch(()=>{});
  });
  await page.locator('[id^="sp_message_container_"]').waitFor({state:'detached',timeout:5000}).catch(()=>{});
  await page.waitForTimeout(500);
 }
}

function matchCode(text:string,map:Record<string,string>){
 const upper=text.toUpperCase();
 return Object.entries(map).sort((a,b)=>b[0].length-a[0].length).find(([name])=>upper.includes(name))?.[1]??null;
}

async function popupVisible(page:Page,timeout=700){
 return page.locator('.si-popup__container').waitFor({state:'visible',timeout}).then(()=>true).catch(()=>false);
}

async function openDetails(page:Page,cell:Locator){
 await cell.click({timeout:1500}).catch(async()=>{await cell.click({force:true,timeout:800}).catch(()=>{})});
 if(await popupVisible(page,900))return 0;
 const candidates=[cell.locator('xpath=..'),cell.locator('xpath=../..'),cell.locator('xpath=../../..')];
 for(let level=0;level<candidates.length;level++){
  const target=candidates[level];
  if(!await target.count())continue;
  await target.click({timeout:2500}).catch(async()=>{await target.click({force:true,timeout:1500}).catch(()=>{})});
  if(await popupVisible(page))return level+1;
  await target.evaluate((el:any)=>el.click?.()).catch(()=>{});
  if(await popupVisible(page))return level+1;
 }
 return -1;
}

async function popupRaces(page:Page){
 await page.waitForSelector('.si-popup__container',{timeout:10000});
 const popup=page.locator('.si-popup__container');
 await popup.locator('.si-accordion__box').first().waitFor({state:'visible',timeout:5000}).catch(()=>{});
 await popup.locator('.si-totalPts__counts em').first().waitFor({state:'visible',timeout:3000}).catch(()=>{});
 const boxes=popup.locator('.si-accordion__box');
 const count=await boxes.count();
 const races:{round:string,raceName:string,totalPoints:number}[]=[];
 let round=0;
 for(let i=0;i<count;i++){
  const box=boxes.nth(i);
  const raceName=(await box.locator('.si-league__card-title span').first().textContent().catch(()=>null))?.trim();
  const pointsText=(await box.locator('.si-totalPts__counts em').first().textContent().catch(()=>null))?.trim();
  if(!raceName||raceName.toLowerCase()==='season')continue;
  round++;
  const points=Number((pointsText??'').replace(/[^0-9-]/g,''));
  if(Number.isFinite(points))races.push({round:String(round),raceName,totalPoints:points});
 }
 return races;
}

async function closePopup(page:Page){
 const popup=page.locator('.si-popup__container');
 if(!await popup.count())return true;
 const close=page.locator('.si-popup__close').first();
 if(await close.count()){
  await close.click({timeout:1500}).catch(async()=>{await close.evaluate((el:any)=>el.click?.()).catch(()=>{})});
 }
 if(await popup.waitFor({state:'hidden',timeout:1800}).then(()=>true).catch(()=>false))return true;
 await page.keyboard.press('Escape').catch(()=>{});
 return popup.waitFor({state:'hidden',timeout:1200}).then(()=>true).catch(()=>false);
}

async function loadTab(page:Page,tab:'driver'|'constructor'){
 await page.goto(BASE+'?tab='+tab+'&filter=fPoints',{waitUntil:'networkidle',timeout:60000});
 await consent(page);
 await page.waitForSelector('.si-main__container',{timeout:30000});
 const items=page.locator('div[class*="si-stats__list-item"]');
 await items.first().waitFor({state:'visible',timeout:10000});
 await page.waitForFunction((selector)=>document.querySelectorAll(selector).length>0,'div[class*="si-stats__list-item"]',{timeout:10000});
}

async function freshTab(context:BrowserContext,tab:'driver'|'constructor'){
 const page=await context.newPage();
 try{
  await loadTab(page,tab);
  return page;
 }catch(error){
  await page.close().catch(()=>{});
  throw error;
 }
}

async function scrape(context:BrowserContext,tab:'driver'|'constructor'){
 let page=await freshTab(context,tab);
 let itemCount=await page.locator('div[class*="si-stats__list-item"]').count();
 const group=tab==='driver'?4:3;
 const map=tab==='driver'?DRIVER_CODES:CONSTRUCTOR_CODES;
 const assets:{abbreviation:string;races:{round:string;raceName:string;totalPoints:number}[]}[]=[];

 async function resetPage(){
  await page.close().catch(()=>{});
  page=await freshTab(context,tab);
 }

 console.log(`[${tab}] list items: ${itemCount}`);
 for(let i=0;i+group-1<itemCount;i+=group){
  try{
   let items=page.locator('div[class*="si-stats__list-item"]');
   if(await items.count()<=i){await resetPage();items=page.locator('div[class*="si-stats__list-item"]');itemCount=await items.count()}
   const primary=items.nth(i);
   await primary.waitFor({state:'visible',timeout:5000});
   const text=((await primary.textContent({timeout:5000}))??'').trim();
   const code=matchCode(text,map);
   if(!code)continue;
   console.log(`[${tab}] candidate ${code} @ item ${i}/${itemCount}`);

   let success=false;
   for(let attempt=1;attempt<=2&&!success;attempt++){
    try{
     const closed=await closePopup(page);
     if(!closed){
      console.warn(`[${tab}] ${code}: stale popup would not close; opening fresh tab`);
      await resetPage();
     }

     let liveItems=page.locator('div[class*="si-stats__list-item"]');
     if(await liveItems.count()<=i){await resetPage();liveItems=page.locator('div[class*="si-stats__list-item"]')}
     const livePrimary=liveItems.nth(i);
     await livePrimary.waitFor({state:'visible',timeout:5000});

     const openedAt=await openDetails(page,livePrimary);
     if(openedAt<0)throw new Error('Details popup did not open');

     const popupName=((await page.locator('.si-popup__container .si-player__name').first().textContent({timeout:3000}).catch(()=>''))||'').trim();
     if(!popupName)throw new Error('Popup opened without player/constructor name');

     const expectedNames=tab==='driver'
      ?Object.entries(DRIVER_CODES).filter(([,v])=>v===code).map(([k])=>k)
      :Object.entries(CONSTRUCTOR_CODES).filter(([,v])=>v===code).map(([k])=>k);
     const normalizedName=popupName.toUpperCase();

     if(!expectedNames.some(name=>normalizedName.includes(name))){
      if(attempt===1){
       console.warn(`[${tab}] ${code}: stale popup ${popupName}; opening fresh tab and retrying`);
       await resetPage();
       continue;
      }
      throw new Error(`Popup identity mismatch after retry: expected ${code}, got ${popupName}`);
     }

     console.log(`[${tab}] ${code}: popup opened at ancestor level ${openedAt}`);
     const races=await popupRaces(page);
     if(races.length){
      assets.push({abbreviation:code,races});
      console.log(`[${tab}] ${code}: ${races.length} races`);
      success=true;
     }
    }catch(error){
     if(attempt===1){
      console.warn(`[${tab}] ${code}: retrying in fresh tab after ${error instanceof Error?error.message:'unknown error'}`);
      await resetPage().catch(()=>{});
     }else{
      console.warn(`[${tab}] ${code}: popup parse failed`,error instanceof Error?error.message:error);
     }
    }finally{
     if(success)await closePopup(page);
    }
   }
  }catch(error){
   console.warn(`[${tab}] item ${i}: row recovery failed`,error instanceof Error?error.message:error);
   await resetPage().catch(()=>{});
  }
 }

 await page.close().catch(()=>{});
 console.log(`[${tab}] parsed assets: ${assets.length}`);
 return assets;
}

async function main(){
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1200}});
 try{
  const drivers=await scrape(context,'driver');
  const constructors=await scrape(context,'constructor');
  if(!drivers.length&&!constructors.length)throw new Error('Official Statistics UI returned no parsable assets. See diagnostics above.');
  const response=await fetch(app+'/api/fantasy-scores/statistics-import',{method:'POST',headers:{'content-type':'application/json','x-market-admin-key':key},body:JSON.stringify({season:2026,data:[...drivers,...constructors]})});
  const result=await response.json();if(!response.ok)throw new Error(JSON.stringify(result));
  console.log(JSON.stringify({drivers:drivers.length,constructors:constructors.length,...result},null,2));
 }finally{
  await context.close().catch(()=>{});
  await browser.close();
 }
}

main().catch((error)=>{console.error(error);process.exitCode=1});
