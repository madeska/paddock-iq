import assert from 'node:assert/strict';
import {test} from 'node:test';
import {normalizeF1TeamExport} from '../src/lib/f1-team-import';
const market = ['VER','NOR','LEC','ANT','PIA'].map(code=>({code,name:code,type:'DRIVER' as const})).concat([]);
const assets = [...market,{code:'MER',name:'Mercedes',type:'CONSTRUCTOR' as const},{code:'RBR',name:'Red Bull Racing',type:'CONSTRUCTOR' as const}];
const players = assets.map((a,i)=>({PlayerId:String(i+1),DriverTLA:a.type==='DRIVER'?a.code:'',TeamName:a.name,PositionName:a.type}));
function fixture(){return {format:'paddock-iq-f1-v1',capturedAt:new Date().toISOString(),season:2026,round:18,players,teams:[{teamno:1,teamname:'Race%20Team',playerid:players.map(p=>({id:p.PlayerId})),capplayerid:'1',team_info:{teamBal:0},usersubsleft:0,ovpoints:-5,islimitlesstaken:true,iswildcardtaken:false}]};}
test('imports actual F1 fields and preserves zero balances and negative points',()=>{
 const r=normalizeF1TeamExport(fixture(),assets,2026,18);
 assert.equal(r.teams[0].name,'Race Team'); assert.equal(r.teams[0].cashBalance,0);assert.equal(r.teams[0].freeTransfers,0);assert.equal(r.teams[0].totalPoints,-5);
 assert.deepEqual(r.teams[0].assets.map(a=>[a.code,a.isDoubled]),[['VER',true],['NOR',false],['LEC',false],['ANT',false],['PIA',false],['MER',false],['RBR',false]]);
 assert.deepEqual(r.teams[0].chips,{LL:'USED',WC:'AVAILABLE'});
});
test('missing optional data stays unknown rather than inventing balances or chip availability',()=>{
 const f=fixture();delete (f.teams[0] as any).team_info;delete (f.teams[0] as any).usersubsleft;delete (f.teams[0] as any).ovpoints;delete (f.teams[0] as any).iswildcardtaken;
 const t=normalizeF1TeamExport(f,assets,2026,18).teams[0];assert.equal(t.cashBalance,undefined);assert.equal(t.freeTransfers,undefined);assert.equal(t.totalPoints,undefined);assert.equal(t.chips.WC,undefined);
});
test('rejects incomplete, duplicate, unmapped and invalid boost teams',()=>{
 for(const mutate of [(f:any)=>f.teams[0].playerid.pop(),(f:any)=>f.teams[0].playerid[1]={id:'1'},(f:any)=>f.teams[0].playerid[1]={id:'999'},(f:any)=>f.teams[0].capplayerid='6']){const f=fixture();mutate(f);assert.throws(()=>normalizeF1TeamExport(f,assets,2026,18));}
});
test('rejects mismatched rounds, stale exports and unsupported formats',()=>{
 const f=fixture();assert.throws(()=>normalizeF1TeamExport(f,assets,2026,17));f.capturedAt='2020-01-01T00:00:00Z';assert.throws(()=>normalizeF1TeamExport(f,assets,2026,18));f.format='other';assert.throws(()=>normalizeF1TeamExport(f,assets,2026,18));
});
test('does not pass private or arbitrary fields through to persisted import',()=>{
 const f=fixture() as any;f.token='secret';f.teams[0].GUID='secret';const result=normalizeF1TeamExport(f,assets,2026,18);assert.ok(!JSON.stringify(result).includes('secret'));
});
import {runInNewContext} from 'node:vm';
import {f1TeamBookmarklet} from '../src/lib/f1-team-browser-helper';
test('browser helper exports only lineup fields using same-origin requests',async()=>{
 let blob:Blob|undefined;let clicked=false;const calls:string[]=[];const alerts:string[]=[];
 class BrowserURL extends URL{static createObjectURL(b:Blob){blob=b;return 'blob:export'}static revokeObjectURL(){}}
 const context={location:{origin:'https://fantasy.formula1.com'},performance:{getEntriesByType:()=>[{name:'https://fantasy.formula1.com/services/user/gameplay/private-guid/getteam/0/0/0/0?secret=private'}]},URL:BrowserURL,Blob,AbortSignal,Date,setTimeout:()=>{},alert:(s:string)=>alerts.push(s),document:{createElement:()=>({click(){clicked=true},href:'',download:''})},fetch:async(url:string,options:any)=>{assert.equal(new URL(url).origin,'https://fantasy.formula1.com');assert.equal(options.credentials,'same-origin');assert.equal(options.redirect,'error');assert.ok(!url.includes('secret='));calls.push(url);return {ok:true,json:async()=>({Meta:{Success:true},Data:{Value:url.includes('/schedule/')?[{GamedayId:18,PhaseId:1,Season:'2026',MatchStatus:'1'}]:url.includes('/getteam/')?{mdid:18,userTeam:[{...fixture().teams[0],GUID:'private-secret',token:'private-secret'}]}:players}})}}};
 await runInNewContext(f1TeamBookmarklet().replace('javascript:void ',''),context);
 assert.equal(calls.length,3);assert.ok(calls.some(url=>url.includes("/getteam/0/0/18/1")));assert.ok(clicked);const text=await blob!.text();assert.ok(!text.includes('private'));const exported=JSON.parse(text);assert.equal(exported.round,18);assert.equal(normalizeF1TeamExport(exported,assets,2026,18).teams[0].name,'Race Team');assert.equal(alerts.length,1);
});
test('helper refuses other origins without reading session or sending requests',async()=>{
 let requests=0;let message='';await runInNewContext(f1TeamBookmarklet().replace('javascript:void ',''),{location:{origin:'https://example.com'},fetch:()=>requests++,alert:(s:string)=>message=s,Error});assert.equal(requests,0);assert.match(message,/F1 Fantasy/);
});

import {NextRequest} from 'next/server';
import {prisma} from '../src/lib/prisma';
import {POST as importF1Team} from '../src/app/api/team/f1/import/route';
test('API previews without writes and saves the selected team through TeamSnapshot',async()=>{
 const originalFind=prisma.asset.findMany;const originalTransaction=prisma.$transaction;
 let snapshots:any[]=[];let slots:any[]=[];
 (prisma.asset as any).findMany=async()=>assets;
 (prisma as any).$transaction=async(fn:any)=>fn({user:{upsert:async()=>({id:'profile'})},fantasyTeam:{upsert:async()=>({id:'team'})},grandPrix:{upsert:async()=>({id:'gp'})},asset:{findUnique:async({where}:any)=>({id:where.season_code_type.code})},teamSnapshot:{create:async({data}:any)=>{snapshots.push(data);return {id:'snapshot'}}},teamSlot:{createMany:async({data}:any)=>{slots=data}},chipUsage:{upsert:async()=>({})}});
 const send=(body:any,origin='https://paddock.test')=>importF1Team(new NextRequest('https://paddock.test/api/team/f1/import',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
 try{
  const input={action:'preview',export:fixture(),season:2026,round:18};
  const preview=await send(input);assert.equal(preview.status,200);assert.equal(preview.headers.get('cache-control'),'no-store');assert.equal(snapshots.length,0);assert.equal((await preview.json()).teams[0].name,'Race Team');
  const saved=await send({...input,action:'save',email:'user@example.test',teamNo:1});assert.equal(saved.status,200);assert.equal((await saved.json()).snapshotId,'snapshot');assert.equal(snapshots[0].cashBalance,0);assert.equal(snapshots[0].freeTransfers,0);assert.equal(snapshots[0].totalPoints,-5);assert.equal(slots.length,7);assert.deepEqual(slots.filter(s=>s.isDoubled).map(s=>s.assetId),['VER']);
  assert.equal((await send(input,'https://evil.test')).status,403);
  assert.equal((await send({...input,action:'save',teamNo:3,email:'user@example.test'})).status,400);
  assert.equal((await send({...input,round:17})).status,400);assert.equal(snapshots.length,1);
 }finally{(prisma.asset as any).findMany=originalFind;(prisma as any).$transaction=originalTransaction;await prisma.$disconnect()}
});

test('paid transfers leave zero free transfers rather than rejecting a valid F1 team',()=>{const f=fixture();f.teams[0].usersubsleft=-1;assert.equal(normalizeF1TeamExport(f,assets,2026,18).teams[0].freeTransfers,0)});
