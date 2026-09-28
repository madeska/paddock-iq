import { chromium } from 'playwright';

const URL='https://fantasy.formula1.com/en/statistics/details?tab=driver&filter=fPoints';

async function main(){
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  const seen=new Set<string>();

  page.on('response',async(response)=>{
   const url=response.url();
   const type=response.request().resourceType();
   if(!['xhr','fetch'].includes(type))return;
   if(seen.has(url))return;
   seen.add(url);

   const contentType=response.headers()['content-type']||'';
   let summary='';
   if(contentType.includes('json')){
    try{
     const json=await response.json();
     if(Array.isArray(json))summary='array['+json.length+']';
     else if(json&&typeof json==='object')summary='keys='+Object.keys(json).slice(0,20).join(',');
    }catch{}
   }
   console.log(response.status(),type,url,summary);
  });

  await page.goto(URL,{waitUntil:'networkidle',timeout:60000});
  await page.waitForTimeout(5000);
 }finally{
  await browser.close();
 }
}

main().catch(error=>{console.error(error);process.exitCode=1});
