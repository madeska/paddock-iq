import assert from 'node:assert/strict';import {chromium} from 'playwright';
async function main(){const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const base=process.env.PADDOCK_TEST_URL||'http://localhost:3102';
 const assets=['VER','ANT','LEC','HAM','RUS','MER','FER'].map((code,i)=>({code,name:code,type:i<5?'DRIVER':'CONSTRUCTOR',price:10}));let saved:any;
 await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;if(path==='/api/account')return route.fulfill({json:{user:{email:'fixture@example.test'},maintenance:false}});if(path==='/api/market')return route.fulfill({json:{round:18,assets}});if(path==='/api/team/f1/helper')return route.fulfill({json:{bookmarklet:'javascript:void(0)',fileBookmarklet:'javascript:void(0)'}});if(path==='/api/team/import'){saved=route.request().postDataJSON();return route.fulfill({json:{teamId:'fixture',snapshotId:'snapshot'}})}return route.fulfill({status:404,json:{error:'Unsupported fixture request'}})});
 await page.goto(base+'/team-setup-ui-test-preview');await page.getByRole('heading',{name:'Add your teams',exact:true}).waitFor();
 await page.getByText('Manual setup (fallback)',{exact:true}).click();await page.getByLabel('Team name',{exact:true}).fill('Manual team');
 for(let i=0;i<5;i++)await page.getByLabel('Driver '+(i+1),{exact:true}).selectOption(assets[i].code);
 await page.getByLabel('2× driver',{exact:true}).selectOption('VER');
 await page.getByLabel('Constructor 1',{exact:true}).selectOption('MER');await page.getByLabel('Constructor 2',{exact:true}).selectOption('FER');
 assert.equal(await page.getByLabel('2× driver',{exact:true}).inputValue(),'VER');
 await page.getByLabel('Total points',{exact:true}).fill('-5');await page.getByRole('button',{name:'Save team',exact:true}).click();await page.getByText('Team saved. Open My teams to view your lineup.',{exact:true}).waitFor();
 assert.equal(saved.assets.length,7);assert.equal(saved.totalPoints,-5);assert.deepEqual(saved.assets.filter((asset:any)=>asset.isDoubled).map((asset:any)=>asset.code),['VER']);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:'docs/team-setup-mobile.png',fullPage:true});
 await page.goto(base+'/privacy');await page.getByRole('heading',{name:'Privacy',exact:true}).waitFor();
 await page.goto(base+'/login');await page.getByRole('heading',{name:'Your teams, in one account',exact:true}).waitFor();await page.screenshot({path:'docs/login-mobile.png',fullPage:true});
 const missing=await page.goto(base+'/does-not-exist');assert.equal(missing?.status(),404);await page.getByRole('heading',{name:'Page not found',exact:true}).waitFor();
 console.log('Setup: x2 survives constructor selection, save/negative points, mobile, login/privacy/404 passed.');
 }finally{await browser.close()}}
main().catch(error=>{console.error(error);process.exitCode=1});
