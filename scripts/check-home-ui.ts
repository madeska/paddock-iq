import assert from 'node:assert/strict';
import {chromium} from 'playwright';
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const assets=[...['VER','ANT','LEC','HAM','RUS','NOR'].map((code,i)=>({code,name:['Max Verstappen','Kimi Antonelli','Charles Leclerc','Lewis Hamilton','George Russell','Lando Norris'][i],type:'DRIVER',price:i<2?25:6,expectedPoints:30-i,boostExpectedPoints:35-i,expectedDelta:.2})),...['MER','FER','RBR'].map(code=>({code,name:code,type:'CONSTRUCTOR',price:20,expectedPoints:50,expectedDelta:.3}))].map(a=>({...a,probabilityMaxRise:.6,probabilitySmallRise:.2,probabilitySmallFall:.1,probabilityMaxFall:.1,recentFantasyScores:[{round:16,points:20},{round:17,points:25}]}));
 const market={season:2026,round:18,grandPrix:'United States Grand Prix',deadline:'2026-10-24T21:00:00Z',complete:true,incomplete:[],assets};
 await page.route('**/api/market?*',route=>route.fulfill({json:market}));
 await page.route('**/api/fantasy-scores/sync',route=>route.fulfill({json:{errors:[],status:'WAITING',verified:0,total:9,saved:0,corrected:0}}));
 await page.route('**/api/predictions/auto',route=>route.fulfill({json:{weekendLock:{deadline:'2026-10-24T21:00:00Z',source:'Verified calendar'},forecastAt:'2026-10-13T12:00:00Z',practiceSnapshot:{sessionName:'Practice 3',drivers:22,sprintQualifyingDrivers:0},weekendNews:{coverage:'Official sources',mentions:[],errors:[]}}}));
 await page.goto(process.env.PADDOCK_TEST_URL||'http://localhost:3102');
 await page.getByRole('heading',{name:'United States Grand Prix',exact:true}).waitFor();
 assert.equal(await page.getByRole('columnheader',{name:/Official pts/}).count(),0);
 assert.equal(await page.getByRole('columnheader',{name:/Odds/}).count(),0);
 await page.getByLabel('Show price probabilities').check();
 assert.ok(await page.getByRole('columnheader',{name:/Odds/}).count()>0);
 await page.getByLabel('Show price probabilities').uncheck();
 await page.getByLabel('Find a driver',{exact:true}).fill('No such driver');
 assert.equal(await page.locator('[data-market="drivers"] tbody td').first().getAttribute('colspan'),'6');
 await page.getByLabel('Find a driver',{exact:true}).fill('');
 await page.getByText('Advanced filters',{exact:false}).click();
 await page.getByRole('button',{name:'VER',exact:true}).click();
 await page.getByRole('button',{name:'Generate teams',exact:true}).click();
 await page.getByRole('columnheader',{name:'Confidence',exact:true}).waitFor();
 assert.ok((await page.locator('tbody').last().innerText()).includes('VER'));
 await page.getByLabel('Budget, $M',{exact:true}).fill('125');
 assert.equal(await page.getByRole('columnheader',{name:'Confidence',exact:true}).count(),0);
 await page.getByRole('button',{name:'Refresh projections',exact:true}).click();
 await page.getByText('Practice 3: 22 drivers',{exact:false}).waitFor();
 await page.getByText('Advanced filters',{exact:false}).click();
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:'docs/home-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Constructors',exact:true}).click();
 assert.equal(await page.locator('[data-market="drivers"]').isVisible(),false);
 assert.equal(await page.locator('[data-market="constructors"]').isVisible(),true);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.getByLabel('Show price probabilities').check();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.getByLabel('Show price probabilities').uncheck();
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:'docs/home-mobile.png',fullPage:true});
 market.deadline='';await page.reload();await page.getByText('Schedule unavailable',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Refresh projections',exact:true}).click();await page.locator('time[datetime="2026-10-24T21:00:00Z"]').waitFor();
 console.log('Home: compact/detail tables, filters, generation, refresh and mobile switching passed.');
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
