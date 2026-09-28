import { chromium } from 'playwright';

const URL='https://fantasy.formula1.com/en/statistics/details?tab=driver&filter=fPoints';

async function consent(page:any){
 const frame=page.locator('iframe[title="SP Consent Message"], iframe[id^="sp_message_iframe_"]').first();
 if(await frame.count()){
  const body=frame.contentFrame();
  const button=body.getByRole('button',{name:/Essential only cookies/i}).or(body.getByText(/Essential only cookies/i)).first();
  await button.click({timeout:5000}).catch(()=>{});
  await page.locator('[id^="sp_message_container_"]').waitFor({state:'detached',timeout:5000}).catch(()=>{});
 }
}

async function main(){
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1200}});
  const seen=new Set<string>();

  await page.goto(URL,{waitUntil:'networkidle',timeout:60000});
  await consent(page);
  await page.waitForSelector('.si-main__container',{timeout:30000});

  page.on('response',async(response)=>{
   const req=response.request();
   if(!['xhr','fetch'].includes(req.resourceType()))return;
   const url=response.url();
   if(seen.has(url))return;
   seen.add(url);
   const ct=response.headers()['content-type']||'';
   let shape='';
   if(ct.includes('json')){
    try{
     const json=await response.json();
     shape=Array.isArray(json)?'array['+json.length+']':json&&typeof json==='object'?'keys='+Object.keys(json).slice(0,30).join(','):'';
    }catch{}
   }
   console.log(response.status(),req.method(),url,shape);
  });

  const items=page.locator('div[class*="si-stats__list-item"]');
  const count=await items.count();
  for(let i=0;i<count;i++){
   const item=items.nth(i);
   const text=((await item.textContent())||'').trim();
   if(!text.toUpperCase().includes('ANTONELLI'))continue;
   console.log('Clicking Antonelli row at item',i);
   await item.click({timeout:2000}).catch(async()=>item.locator('xpath=..').click({force:true}));
   await page.locator('.si-popup__container').waitFor({state:'visible',timeout:10000});
   await page.waitForTimeout(5000);
   break;
  }
 }finally{
  await browser.close();
 }
}

main().catch(error=>{console.error(error);process.exitCode=1});
