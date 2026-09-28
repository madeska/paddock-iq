import {chromium,Page,Locator} from 'playwright';
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

async function popupVisible(page:Page,timeout=1200){
 return page.locator('.si-popup__container').waitFor({state:'visible',timeout}).then(()=>true).catch(()=>false);
}

async function openDetails(page:Page,cell:Locator){
 const candidates=[cell,cell.locator('xpath=..'),cell.locator('xpath=../..'),cell.locator('xpath=../../..')];
 for(let level=0;level<candidates.length;level++){
  const target=candidates[level];
  if(!await target.count())continue;
  await target.click({timeout:2500}).catch(async()=>{await target.click({force:true,timeout:1500}).catch(()=>{})});
  if(await popupVisible(page))return level;
  await target.evaluate((el:any)=>el.click?.()).catch(()=>{});
  if(await popupVisible(page))return level;
 }
 return -1;
}

async function popupRaces(page:Page){
 await page.waitForSelector('.si-popup__container',{timeout:10000});
 await page.waitForTimeout(700);
 const popup=page.locator('.si-popup__container');
 const boxes=popup.locator('.si-accordion__box');
 const count=await boxes.count();
 const races:{raceName:string,totalPoints:number}[]=[];
 for(let i=0;i<count;i++){
  const box=boxes.nth(i);
  const raceName=(await box.locator('.si-league__card-title span').first().textContent().catch(()=>null))?.trim();
  const pointsText=(await box.locator('.si-totalPts__counts em').first().textContent().catch(()=>null))?.trim();
  if(!raceName||raceName.toLowerCase()==='season')continue;
  const points=Number((pointsText??'').replace(/[^0-9-]/g,''));
  if(Number.isFinite(points))races.push({raceName,totalPoints:points});
 }
 return races;
}

async function closePopup(page:Page){
 await page.locator('.si-popup__container').waitFor({state:'visible',timeout:500}).catch(()=>{});
 const close=page.locator('.si-popup__container button, .si-popup__close, [class*="popup-close"]').filter({hasText:/close|×/i}).first();
 if(await close.count())await close.click({timeout:1500}).catch(()=>{});
 if(await page.locator('.si-popup__container').count())await page.keyboard.press('Escape').catch(()=>{});
 await page.waitForTimeout(250);
}

async function scrape(page:Page,tab:'driver'|'constructor'){
 await page.goto(BASE+'?tab='+tab+'&filter=fPoints',{waitUntil:'networkidle',timeout:60000});
 await consent(page);
 await page.waitForSelector('.si-main__container',{timeout:30000});
 await page.waitForTimeout(2500);

 const items=page.locator('div[class*="si-stats__list-item"]');
 const itemCount=await items.count();
 const group=tab==='driver'?4:3;
 const map=tab==='driver'?DRIVER_CODES:CONSTRUCTOR_CODES;
 const assets:{abbreviation:string;races:{round:string;raceName:string;totalPoints:number}[]}[]=[];
 let raceOrder:string[]=[];

 console.log(`[${tab}] list items: ${itemCount}`);
 for(let i=0;i+group-1<itemCount;i+=group){
  const primary=items.nth(i);
  const text=((await primary.textContent())??'').trim();
  const code=matchCode(text,map);
  if(!code)continue;
  console.log(`[${tab}] candidate ${code} @ item ${i}/${itemCount}`);
  try{
   const openedAt=await openDetails(page,primary);
   if(openedAt<0){
    const html=(await primary.evaluate((el:any)=>el.parentElement?.outerHTML?.slice(0,1200)??el.outerHTML?.slice(0,1200))).replace(/\s+/g,' ');
    throw new Error('Details popup did not open. parent='+html);
   }
   console.log(`[${tab}] ${code}: popup opened at ancestor level ${openedAt}`);
   const races=await popupRaces(page);
   if(!raceOrder.length&&races.length)raceOrder=races.map(r=>r.raceName);
   const normalized=races.map(r=>({round:String(raceOrder.indexOf(r.raceName)+1),...r})).filter(r=>r.round!=='0');
   if(normalized.length){assets.push({abbreviation:code,races:normalized});console.log(`[${tab}] ${code}: ${normalized.length} races`)}
  }catch(error){console.warn(`[${tab}] ${code}: popup parse failed`,error instanceof Error?error.message:error)}
  finally{await closePopup(page)}
 }
 console.log(`[${tab}] parsed assets: ${assets.length}`);
 return assets;
}

async function main(){
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1200}});
  const drivers=await scrape(page,'driver');
  const constructors=await scrape(page,'constructor');
  if(!drivers.length&&!constructors.length)throw new Error('Official Statistics UI returned no parsable assets. See list-item diagnostics above.');
  const response=await fetch(app+'/api/fantasy-scores/statistics-import',{method:'POST',headers:{'content-type':'application/json','x-market-admin-key':key},body:JSON.stringify({season:2026,data:[...drivers,...constructors]})});
  const result=await response.json();if(!response.ok)throw new Error(JSON.stringify(result));
  console.log(JSON.stringify({drivers:drivers.length,constructors:constructors.length,...result},null,2));
 }finally{await browser.close()}
}

main().catch((error)=>{console.error(error);process.exitCode=1});
