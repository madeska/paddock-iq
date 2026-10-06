import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {normalizeF1TeamExport} from '../src/lib/f1-team-import';
import {readFile} from 'node:fs/promises';
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
 try{
 const market=[...['VER','NOR','LEC','ANT','PIA'].map(code=>({code,name:code,type:'DRIVER' as const})),{code:'MER',name:'Mercedes',type:'CONSTRUCTOR' as const},{code:'RBR',name:'Red Bull Racing',type:'CONSTRUCTOR' as const}];
 const players=market.map((a,i)=>({PlayerId:String(i+1),DriverTLA:a.type==='DRIVER'?a.code:'',TeamName:a.name,PositionName:a.type}));
 const rawTeam={teamno:1,teamname:'Race%20Team',playerid:players.map(p=>({id:p.PlayerId})),capplayerid:'1',team_info:{teamBal:0,userSubsleft:2,subsallowed:2},usersubsleft:0,ovpoints:-5};
 const apiPage=await browser.newPage();const helperResponse=await apiPage.request.get(new URL('/api/team/f1/helper',process.env.PADDOCK_TEST_URL||'http://localhost:3100/team/import').href);assert.ok(helperResponse.ok());const actualHelper=(await helperResponse.json()).bookmarklet;await apiPage.close();
 const f1=await browser.newPage({acceptDownloads:true});
 await f1.route('https://fantasy.formula1.com/**',async route=>{const path=new URL(route.request().url()).pathname;const value=path.includes('/schedule/')?[{GamedayId:18,PhaseId:1,Season:'2026',MatchStatus:'1'}]:path.includes('/getteam/')?{mdid:18,userTeam:[{...rawTeam,GUID:'private',token:'private'}]}:players;await route.fulfill({contentType:path==='/en/'?'text/html':'application/json',body:path==='/en/'?'<html><body>F1 fixture</body></html>':JSON.stringify({Meta:{Success:true},Data:{Value:value}})})});
 await f1.goto('https://fantasy.formula1.com/en/');await f1.evaluate(()=>fetch('/services/user/gameplay/private/getteam/0/1/17/1'));
 await f1.evaluate(source=>{const a=document.createElement('a');a.setAttribute('href',source);a.id='export';a.textContent='Export';document.body.appendChild(a)},actualHelper);
 f1.on('dialog',dialog=>void dialog.dismiss());
 const [download]=await Promise.all([f1.waitForEvent('download'),f1.locator('#export').click()]);
 const exported=JSON.parse(await readFile((await download.path())!,'utf8'));assert.ok(!JSON.stringify(exported).includes('private'));const normalized=normalizeF1TeamExport(exported,market,2026,18);assert.equal(normalized.teams[0].freeTransfers,2);
 const page=await browser.newPage();let saved:any;
 await page.route('**/api/market?*',route=>route.fulfill({json:{assets:market}}));
 await page.route('**/api/team/f1/import',async route=>{const body=route.request().postDataJSON();if(body.action==='save'){saved=body;await route.fulfill({json:{ok:true,snapshotId:'ui-snapshot',teamId:'ui-team'}})}else await route.fulfill({json:normalized})});
 await page.goto(process.env.PADDOCK_TEST_URL||'http://localhost:3100/team/import');
 await page.getByLabel('F1 team export').setInputFiles({name:'f1-team.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
 await page.getByRole('button',{name:'Preview F1 team'}).click();await page.getByRole('heading',{name:'Race Team'}).waitFor();assert.match(await page.locator('main').innerText(),/VER · Driver · 2×/);
 await page.getByLabel('Paddock IQ profile email').fill('user@example.test');await page.getByRole('button',{name:'Save imported team'}).click();await page.getByRole('status').filter({hasText:'Team saved. Snapshot ui-snapshot'}).waitFor();assert.equal(saved.teamNo,1);assert.equal(saved.season,2026);assert.equal(saved.round,18);
 await page.reload();await page.getByLabel('F1 team export').setInputFiles({name:'f1-team.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.getByRole('button',{name:'Preview F1 team'}).click();await page.getByRole('heading',{name:'Race Team'}).waitFor();assert.equal(await page.getByLabel('Paddock IQ profile email').count(),0);await page.getByRole('button',{name:'Save imported team'}).click();await page.getByRole('status').filter({hasText:'Team saved. Snapshot ui-snapshot'}).waitFor();assert.equal(saved.email,'user@example.test');
 await page.getByLabel('F1 team export').setInputFiles({name:'f1-team-new.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.getByRole('button',{name:'Preview F1 team'}).click();await page.getByRole('button',{name:'Change profile'}).click();await page.getByLabel('Paddock IQ profile email').fill('other@example.test');await page.getByRole('button',{name:'Save imported team'}).click();await page.getByRole('status').filter({hasText:'Team saved. Snapshot ui-snapshot'}).waitFor();assert.equal(saved.email,'other@example.test');
 await page.getByText('Manual setup (fallback)',{exact:true}).click();await page.getByRole('button',{name:'Save team',exact:true}).waitFor({state:'visible'});
 let requestedTeam='';await page.route('**/api/team?*',async route=>{requestedTeam=route.request().url();await route.fulfill({json:{user:{email:'other@example.test',name:null},teams:[{id:'ui-team',name:'Race Team'}],team:{id:'ui-team',name:'Race Team',season:2026},snapshot:{id:'snapshot',capturedAt:new Date().toISOString(),grandPrix:{round:18,name:'Round 18'},cashBalance:0,freeTransfers:2,totalPoints:-5,assets:[],chips:[]}}})});
 await page.goto(new URL('/my-team',process.env.PADDOCK_TEST_URL||'http://localhost:3100/team/import').href);await page.getByText('Free transfers',{exact:true}).waitFor();assert.equal(new URL(requestedTeam).searchParams.get('email'),'other@example.test');assert.equal(new URL(requestedTeam).searchParams.get('teamId'),'ui-team');assert.equal(await page.getByText('Free transfers',{exact:true}).locator('..').locator('strong').innerText(),'2');
 console.log('Helper export, current free transfers, profile persistence/change, My Team auto-load and manual fallback passed.');
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
