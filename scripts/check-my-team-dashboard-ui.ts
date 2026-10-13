import assert from 'node:assert/strict';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {chromium} from 'playwright';
async function main(){
 const previewDirectory=resolve('src/app/my-team-ui-test-preview');let previewCreated=false;
 if(!previewDirectory.startsWith(resolve('src/app')+sep))throw Error('Preview must stay inside the workspace app directory');
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
 try{
 // Isolated local UI fixture; real account layout/API authorization are not modified.
 await mkdir(previewDirectory,{recursive:false});previewCreated=true;
 await writeFile(previewDirectory+'/page.tsx',"export {default} from '../my-team/page';\n",{flag:'wx'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const assets=['VER','ANT','LEC','HAM','RUS','MER','FER'].map((code,i)=>({code,name:code,type:i<5?'DRIVER':'CONSTRUCTOR',isDoubled:i===0,price:10,expectedPoints:20,boostExpectedPoints:25,expectedDelta:.1,recentFantasyScores:[]}));
 const market=[...assets,{...assets[1],code:'NOR',name:'Lando Norris',expectedPoints:30,isDoubled:false}];
 const teams=[{id:'one',name:'Panass'},{id:'two',name:'Boston Racing'}];let selected='one';let holdOptimize:Promise<void>|null=null;
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/account')return route.fulfill({json:{user:{email:'fixture@example.test'}}});
  if(url.pathname==='/api/team'){selected=url.searchParams.get('teamId')||selected;return route.fulfill({json:{user:{email:'fixture@example.test',name:'Test'},teams,team:{...teams.find(t=>t.id===selected),season:2026},snapshot:{grandPrix:{round:18,name:'United States GP'},cashBalance:2,freeTransfers:2,totalPoints:4226,assets,chips:[{code:'WC',status:'AVAILABLE'}]}}})}
  if(url.pathname==='/api/market')return route.fulfill({json:{assets:market}});
  if(url.pathname==='/api/optimize'){if(holdOptimize)await holdOptimize;return route.fulfill({json:{scenarios:[{transfers:0,out:[],incoming:[],recommendedBoost:'VER',score:1,penalty:0,transferPointsGain:0,projectedValueGain:0,projectedNextFreeTransfers:3},{transfers:1,out:['HAM'],incoming:['NOR'],recommendedBoost:'VER',score:2,penalty:0,transferPointsGain:10,projectedValueGain:0,projectedNextFreeTransfers:2}]}})}
  return route.fulfill({status:404,json:{error:'Unsupported fixture request'}});
 });
 await page.goto((process.env.PADDOCK_TEST_URL||'http://localhost:3102')+'/my-team-ui-test-preview');
 await page.getByRole('heading',{name:'Panass · 2026',exact:true}).waitFor();
 assert.equal(await page.locator('[data-owned-asset]').count(),7);
 assert.equal(await page.locator('[data-owned-asset] [data-boost]').count(),1);
 await page.getByRole('button',{name:'Boston Racing',exact:true}).click();await page.getByRole('heading',{name:'Boston Racing · 2026',exact:true}).waitFor();
 assert.equal(selected,'two');
 await page.getByRole('button',{name:'Keep VER',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Allow replacing VER',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Find better transfers',exact:true}).click();
 await page.locator('[data-transfer-comparison]').first().waitFor();
 assert.ok((await page.locator('[data-transfer-comparison]').first().innerText()).includes('HAM'));
 assert.ok((await page.locator('[data-transfer-comparison]').first().innerText()).includes('NOR'));
 await page.getByRole('button',{name:'View 1-transfer comparison',exact:true}).press('Enter');
 assert.equal(await page.locator('[id^="scenario-HAM"]').isVisible(),true);
 await page.getByText('Compare all possible lineups',{exact:true}).click();
 await page.screenshot({path:'docs/my-team-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.screenshot({path:'docs/my-team-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Edit team',exact:true}).click();await page.getByLabel('Team name',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 let releaseOptimize!:()=>void;holdOptimize=new Promise<void>(resolve=>{releaseOptimize=resolve});
 await page.getByText('Detailed prices & probabilities',{exact:true}).click();
 await page.getByRole('button',{name:'Find better transfers',exact:true}).click();await page.getByRole('button',{name:'Finding transfers…',exact:true}).waitFor();
 const hamRow=page.locator('tr').filter({has:page.getByText('HAM',{exact:true})}).first();await hamRow.getByTitle('Lock asset',{exact:true}).click();
 releaseOptimize();await page.getByRole('button',{name:'Find better transfers',exact:true}).waitFor();
 assert.equal(await page.locator('[data-transfer-comparison]').count(),0);
 assert.equal(await page.locator('[data-owned-asset]').getByRole('button',{name:'Allow replacing HAM',exact:true}).getAttribute('aria-pressed'),'true');
 console.log('My Team: switch, seven-asset cards/x2, keep lock, transfer comparison, editor and mobile overflow passed.');
 }finally{await browser.close();if(previewCreated)await rm(previewDirectory,{recursive:true})}
}
main().catch(error=>{console.error(error);process.exitCode=1});
