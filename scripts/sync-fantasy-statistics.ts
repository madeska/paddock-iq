import {chromium,Page} from 'playwright';

const BASE='https://fantasy.formula1.com/en/statistics/details';
const app=process.env.PADDOCK_IQ_URL||'http://localhost:3000';
const key=process.env.MARKET_ADMIN_KEY;
if(!key)throw new Error('MARKET_ADMIN_KEY is required');

async function scrape(page:Page,tab:'driver'|'constructor'){
 await page.goto(BASE+'?tab='+tab+'&filter=fPoints',{waitUntil:'networkidle',timeout:60000});
 await page.getByText(/accept|agree/i).first().click({timeout:2000}).catch(()=>{});
 await page.waitForTimeout(1500);
 const cards=page.locator('[class*="statistic"],[class*="driver"],[class*="constructor"]');
 const n=await cards.count(),out:any[]=[];
 for(let i=0;i<n;i++){
  const card=cards.nth(i),text=(await card.innerText().catch(()=>'' )).trim();
  const code=(text.match(/\b[A-Z]{3}\b/)||[])[0];if(!code)continue;
  await card.click().catch(()=>{});await page.waitForTimeout(250);
  const body=await page.locator('body').innerText();
  const races=[...body.matchAll(/(?:Round\s*)?(\d+)\s+([^\n]+?)\s+(-?\d+)\s*(?:pts|points)/gi)].map(m=>({round:m[1],raceName:m[2].trim(),totalPoints:Number(m[3])}));
  if(races.length)out.push({abbreviation:code,races});
  await page.keyboard.press('Escape').catch(()=>{});
 }
 return out;
}

const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1200}});
 const drivers=await scrape(page,'driver'),constructors=await scrape(page,'constructor');
 if(!drivers.length&&!constructors.length)throw new Error('Official Statistics UI returned no parsable assets; DOM selectors may need refresh.');
 const response=await fetch(app+'/api/fantasy-scores/statistics-import',{method:'POST',headers:{'content-type':'application/json','x-market-admin-key':key},body:JSON.stringify({season:2026,data:[...drivers,...constructors]})});
 const result=await response.json();if(!response.ok)throw new Error(JSON.stringify(result));
 console.log(JSON.stringify({drivers:drivers.length,constructors:constructors.length,...result},null,2));
}finally{await browser.close()}
