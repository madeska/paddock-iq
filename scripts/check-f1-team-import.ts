import {before,after,mock} from 'node:test';
import {createRequire} from 'node:module';
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
import {POST as importManualTeam} from '../src/app/api/team/import/route';
test('API previews without writes and preserves single-team and manual snapshot behavior',async()=>{
 const originalFind=prisma.asset.findMany;const originalTransaction=prisma.$transaction;
 let snapshots:any[]=[];let slots:any[]=[];
 (prisma.asset as any).findMany=async()=>assets;
 (prisma as any).$transaction=async(fn:any)=>fn({user:{findUniqueOrThrow:async({where}:any)=>{assert.equal(where.id,'profile');return {id:'profile'}},upsert:async()=>({id:'profile'})},fantasyTeam:{findFirst:async()=>null,create:async()=>({id:'team'}),upsert:async()=>({id:'team'})},grandPrix:{upsert:async()=>({id:'gp'})},asset:{findUnique:async({where}:any)=>({id:where.season_code_type.code})},teamSnapshot:{create:async({data}:any)=>{snapshots.push(data);return {id:'snapshot'}}},teamSlot:{createMany:async({data}:any)=>{slots=data}},chipUsage:{upsert:async()=>({})}});
 const send=(body:any,origin='https://paddock.test')=>importF1Team(new NextRequest('https://paddock.test/api/team/f1/import',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
 try{
  const input={action:'preview',export:fixture(),season:2026,round:18};
  const preview=await send(input);assert.equal(preview.status,200);assert.equal(preview.headers.get('cache-control'),'no-store');assert.equal(snapshots.length,0);assert.equal((await preview.json()).teams[0].name,'Race Team');
  const saved=await send({...input,action:'save',email:'user@example.test',teamNo:1});assert.equal(saved.status,200);assert.equal((await saved.json()).snapshotId,'snapshot');assert.equal(snapshots[0].cashBalance,0);assert.equal(snapshots[0].freeTransfers,0);assert.equal(snapshots[0].totalPoints,-5);assert.equal(slots.length,7);assert.deepEqual(slots.filter(s=>s.isDoubled).map(s=>s.assetId),['VER']);
  assert.equal((await send(input,'https://evil.test')).status,403);
  assert.equal((await send({...input,action:'save',teamNo:3,email:'user@example.test'})).status,400);
  assert.equal((await send({...input,round:17})).status,400);assert.equal(snapshots.length,1);
  const manual=await importManualTeam(new NextRequest('https://paddock.test/api/team/import',{method:'POST',headers:{origin:'https://paddock.test','Content-Type':'application/json'},body:JSON.stringify({user:{email:'user@example.test'},team:{name:'Manual',season:2026},round:18,assets:assets.map((a,i)=>({code:a.code,type:a.type,isDoubled:i===0}))})}));assert.equal(manual.status,200);assert.equal((await manual.json()).snapshotId,'snapshot');assert.equal(snapshots.length,2);assert.deepEqual(slots.filter(s=>s.isDoubled).map(s=>s.assetId),['VER']);
 }finally{(prisma.asset as any).findMany=originalFind;(prisma as any).$transaction=originalTransaction;await prisma.$disconnect()}
});

test('paid transfers leave zero free transfers rather than rejecting a valid F1 team',()=>{const f=fixture();f.teams[0].usersubsleft=-1;assert.equal(normalizeF1TeamExport(f,assets,2026,18).teams[0].freeTransfers,0)});
test('live F1 constructor rows use DriverTLA even when TeamName is empty',()=>{
 const f=fixture();f.players=f.players.map((p,i)=>i<5?p:{...p,DriverTLA:i===5?'MER':'RBR',TeamName:''});
 assert.deepEqual(normalizeF1TeamExport(f,assets,2026,18).teams[0].assets.slice(5).map(a=>a.code),['MER','RBR']);
});
test('F1 constructor aliases match existing HAS and RB market codes',()=>{
 const f=fixture();f.players=f.players.map((p,i)=>i<5?p:{...p,DriverTLA:i===5?'HAA':'RBS',TeamName:''});
 const aliasMarket=[...market,{code:'HAS',name:'Haas',type:'CONSTRUCTOR' as const},{code:'RB',name:'Racing Bulls',type:'CONSTRUCTOR' as const}];
 assert.deepEqual(normalizeF1TeamExport(f,aliasMarket,2026,18).teams[0].assets.slice(5).map(a=>a.code),['HAS','RB']);
});
test('live F1 positive chip markers are used, zero is available, missing is unknown',()=>{
 const f=fixture() as any;Object.assign(f.teams[0],{isautopilottaken:4,isnonigativetaken:5,isextradrstaken:6,isfinalfixtaken:0});
 assert.deepEqual(normalizeF1TeamExport(f,assets,2026,18).teams[0].chips,{LL:'USED',WC:'AVAILABLE',AP:'USED',NN:'USED',DRS:'USED',FF:'AVAILABLE'});
});
test('current team_info transfer balance overrides the completed-round top-level balance',()=>{const f=fixture() as any;f.teams[0].team_info.userSubsleft=2;assert.equal(normalizeF1TeamExport(f,assets,2026,18).teams[0].freeTransfers,2);f.teams[0].team_info.userSubsleft=0;f.teams[0].usersubsleft=3;assert.equal(normalizeF1TeamExport(f,assets,2026,18).teams[0].freeTransfers,0)});
test('one save persists all exported teams in one transaction with separate snapshots',async()=>{
 const originalFind=prisma.asset.findMany,originalTransaction=prisma.$transaction;const snapshots:any[]=[];const slotBatches:any[]=[];let transactions=0;
 (prisma.asset as any).findMany=async()=>assets;
 (prisma as any).$transaction=async(fn:any)=>{transactions++;return fn({user:{findUniqueOrThrow:async({where}:any)=>{assert.equal(where.id,'profile');return {id:'profile'}},upsert:async()=>({id:'profile'})},fantasyTeam:{findFirst:async()=>null,create:async({data}:any)=>({id:data.name}),upsert:async({create}:any)=>({id:create.name})},grandPrix:{upsert:async()=>({id:'gp'})},asset:{findUnique:async({where}:any)=>({id:where.season_code_type.code})},teamSnapshot:{create:async({data}:any)=>{snapshots.push(data);return {id:'snapshot-'+data.teamId}}},teamSlot:{createMany:async({data}:any)=>slotBatches.push(data)},chipUsage:{upsert:async()=>({})}})};
 const f=fixture();f.teams.push({...f.teams[0],teamno:2,teamname:'Second',capplayerid:'2',team_info:{teamBal:0.4},usersubsleft:3,ovpoints:100});
 const send=()=>importF1Team(new NextRequest('https://paddock.test/api/team/f1/import',{method:'POST',headers:{origin:'https://paddock.test','Content-Type':'application/json'},body:JSON.stringify({action:'save',export:f,season:2026,round:18,email:'user@example.test',teamNo:2})}));
 try{
  const response=await send();assert.equal(response.status,200);const json=await response.json();assert.equal(json.teams.length,2);assert.equal(json.teamId,'Second');assert.equal(transactions,1);
  assert.deepEqual(snapshots.map(s=>[s.teamId,s.cashBalance,s.freeTransfers]),[['Race Team',0,0],['Second',0.4,3]]);assert.deepEqual(slotBatches.map(batch=>batch.filter((s:any)=>s.isDoubled).map((s:any)=>s.assetId)),[['VER'],['NOR']]);
  f.teams[1].playerid=[{id:'1'}];assert.equal((await send()).status,400);assert.equal(transactions,1);assert.equal(snapshots.length,2);
 }finally{(prisma.asset as any).findMany=originalFind;(prisma as any).$transaction=originalTransaction;await prisma.$disconnect()}
});
import {PATCH as editTeam,DELETE as deleteTeam} from '../src/app/api/team/manage/route';
test('team management edits existing identity and deletes only the owned team dependencies',async()=>{
 const original=prisma.$transaction;const snapshots:any[]=[];const edits:any[]=[];const deleted:any[]=[];
 const tx={user:{findUniqueOrThrow:async({where}:any)=>{assert.equal(where.id,'profile');return {id:'profile'}},upsert:async()=>({id:'profile'})},fantasyTeam:{findFirst:async({where}:any)=>where.id==='owned'&&where.userId==='profile'?{id:'owned',userId:'profile',name:'Original',season:2026}:null,update:async({where,data}:any)=>{edits.push({where,data});return {id:where.id}},findMany:async()=>[{id:'remaining',name:'Remaining'}],delete:async({where}:any)=>deleted.push(['team',where])},grandPrix:{upsert:async()=>({id:'gp'})},asset:{findUnique:async({where}:any)=>assets.some(a=>a.code===where.season_code_type.code)?{id:where.season_code_type.code}:null},teamSnapshot:{create:async({data}:any)=>{snapshots.push(data);return {id:'edited-snapshot'}},deleteMany:async({where}:any)=>deleted.push(['snapshots',where])},teamSlot:{createMany:async()=>{},deleteMany:async({where}:any)=>deleted.push(['slots',where])},transfer:{deleteMany:async({where}:any)=>deleted.push(['transfers',where])},chipUsage:{upsert:async()=>{},deleteMany:async({where}:any)=>deleted.push(['chips',where])},strategyScenario:{deleteMany:async({where}:any)=>deleted.push(['scenarios',where])}};
 (prisma as any).$transaction=async(fn:any)=>fn(tx);
 const body={email:'user@example.test',teamId:'owned',name:'Renamed',round:18,cashBalance:2,freeTransfers:3,totalPoints:-5,assets:assets.map((a,i)=>({code:a.code,type:a.type,isDoubled:i===0})),chips:{LL:'USED',WC:'AVAILABLE'}};
 const request=(data:any,method='PATCH',origin='https://paddock.test')=>new NextRequest('https://paddock.test/api/team/manage',{method,headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
 try{
  const saved=await editTeam(request(body));assert.equal(saved.status,200);assert.equal((await saved.json()).teamId,'owned');assert.equal(edits[0].where.id,'owned');assert.equal(edits[0].data.name,'Renamed');assert.equal(snapshots[0].teamId,'owned');assert.equal(snapshots[0].freeTransfers,3);
  assert.equal((await editTeam(request({...body,assets:body.assets.slice(0,6)}))).status,400);assert.equal((await editTeam(request({...body,assets:body.assets.map(a=>({...a,isDoubled:false}))}))).status,400);assert.equal((await editTeam(request({...body,teamId:'foreign'}))).status,404);assert.equal((await editTeam(request(body,'PATCH','https://evil.test'))).status,403);assert.equal(snapshots.length,1);
  assert.equal((await deleteTeam(request({...body,teamId:'foreign'},'DELETE'))).status,404);assert.equal(deleted.length,0);
  const removed=await deleteTeam(request({email:body.email,teamId:'owned'},'DELETE'));assert.equal(removed.status,200);assert.deepEqual((await removed.json()).teams,[{id:'remaining',name:'Remaining'}]);assert.deepEqual(deleted,[['transfers',{snapshot:{teamId:'owned'}}],['slots',{snapshot:{teamId:'owned'}}],['snapshots',{teamId:'owned'}],['chips',{teamId:'owned'}],['scenarios',{teamId:'owned'}],['team',{id:'owned'}]]);
 }finally{(prisma as any).$transaction=original;await prisma.$disconnect()}
});
test('F1 re-import keeps a renamed team identity instead of creating a duplicate',async()=>{
 const find=prisma.asset.findMany,transaction=prisma.$transaction;let stored={id:'owned',userId:'profile',name:'Local rename',season:2026,externalId:'legacy-name:Race Team'};
 (prisma.asset as any).findMany=async()=>assets;
 (prisma as any).$transaction=async(fn:any)=>fn({user:{findUniqueOrThrow:async({where}:any)=>{assert.equal(where.id,'profile');return {id:'profile'}},upsert:async()=>({id:'profile'})},fantasyTeam:{findFirst:async({where}:any)=>where.userId==='profile'&&(where.id===stored.id||where.externalId===stored.externalId)?stored:null,update:async({data}:any)=>{stored={...stored,...data};return stored},upsert:async()=>({id:'duplicate'})},grandPrix:{upsert:async()=>({id:'gp'})},asset:{findUnique:async({where}:any)=>({id:where.season_code_type.code})},teamSnapshot:{create:async()=>({id:'snapshot'})},teamSlot:{createMany:async()=>{}},chipUsage:{upsert:async()=>{}}});
 const request=(data:any,method='POST')=>new NextRequest('https://paddock.test/api/team/f1/import',{method,headers:{origin:'https://paddock.test','Content-Type':'application/json'},body:JSON.stringify(data)});
 const f=fixture();const body={action:'save',export:f,email:'user@example.test',season:2026,round:18};
 try{const first=await importF1Team(request(body));assert.equal(first.status,200);assert.equal((await first.json()).teamId,'owned');assert.equal(stored.externalId,'f1:1');
  const edit=await editTeam(request({email:body.email,teamId:'owned',name:'Again',round:18,assets:assets.map((a,i)=>({...a,isDoubled:i===0})),cashBalance:0,freeTransfers:2,totalPoints:100},'PATCH'));assert.equal(edit.status,200);assert.equal(stored.externalId,'f1:1');
  const second=await importF1Team(request(body));assert.equal(second.status,200);assert.equal((await second.json()).teamId,'owned');
 }finally{(prisma.asset as any).findMany=find;(prisma as any).$transaction=transaction;await prisma.$disconnect()}
});
test('F1 sync handles swapped names and never adopts another numbered team by name',async()=>{
 const find=prisma.asset.findMany,transaction=prisma.$transaction;let rows:Record<string,any>={one:{id:'one',name:'A',externalId:'f1:1',userId:'profile',season:2026},two:{id:'two',name:'B',externalId:'f1:2',userId:'profile',season:2026}};let nextId=0;
 const checkName=(name:string,id?:string)=>{if(Object.values(rows).some(r=>r.id!==id&&r.name===name))throw Object.assign(new Error('duplicate name'),{code:'P2002'})};
 (prisma.asset as any).findMany=async()=>assets;
 (prisma as any).$transaction=async(fn:any)=>fn({user:{findUniqueOrThrow:async({where}:any)=>{assert.equal(where.id,'profile');return {id:'profile'}},upsert:async()=>({id:'profile'})},fantasyTeam:{findFirst:async({where}:any)=>where.userId==='profile'?Object.values(rows).find(r=>where.id?r.id===where.id:where.externalId?r.externalId===where.externalId:r.name===where.name):null,update:async({where,data}:any)=>{checkName(data.name,where.id);rows[where.id]={...rows[where.id],...data};return rows[where.id]},create:async({data}:any)=>{checkName(data.name);const id='new-'+(++nextId);rows[id]={id,...data};return rows[id]},upsert:async({create}:any)=>Object.values(rows).find(r=>r.name===create.name)??{id:'unexpected'}},grandPrix:{upsert:async()=>({id:'gp'})},asset:{findUnique:async({where}:any)=>({id:where.season_code_type.code})},teamSnapshot:{create:async({data}:any)=>({id:'snapshot-'+data.teamId})},teamSlot:{createMany:async()=>{}},chipUsage:{upsert:async()=>{}}});
 const f=fixture();f.teams=[{...f.teams[0],teamno:1,teamname:'B'},{...f.teams[0],teamno:2,teamname:'A'}];
 const send=()=>importF1Team(new NextRequest('https://paddock.test/api/team/f1/import',{method:'POST',headers:{origin:'https://paddock.test','Content-Type':'application/json'},body:JSON.stringify({action:'save',export:f,email:'user@example.test',season:2026,round:18})}));
 try{const swap=await send();assert.equal(swap.status,200);assert.equal(rows.one.name,'B');assert.equal(rows.two.name,'A');
  rows={one:{id:'one',name:'B',externalId:'f1:1',userId:'profile',season:2026}};f.teams=[{...f.teams[0],teamno:2,teamname:'B'},{...f.teams[0],teamno:1,teamname:'A'}];const imported=await send();assert.equal(imported.status,200);const j=await imported.json();assert.equal(j.teams.find((t:any)=>t.teamNo===1).teamId,'one');assert.equal(j.teams.find((t:any)=>t.teamNo===2).teamId,'new-1');assert.equal(rows.one.externalId,'f1:1');assert.equal(Object.keys(rows).length,2);
 }finally{(prisma.asset as any).findMany=find;(prisma as any).$transaction=transaction;await prisma.$disconnect()}
});

let authMock:any,ownerRead:any;
before(()=>{process.env.GOOGLE_CLIENT_ID='test';process.env.GOOGLE_CLIENT_SECRET='test';process.env.NEXTAUTH_SECRET='test-only';process.env.NEXTAUTH_URL='https://paddock.test';authMock=mock.method(createRequire(import.meta.url)('next-auth/next'),'getServerSession',async()=>({ownerId:'profile'}));ownerRead=prisma.user.findUnique;(prisma.user as any).findUnique=async()=>({id:'profile',email:'user@example.test',name:null,googleSubject:'test'})});
after(()=>{authMock.mock.restore();(prisma.user as any).findUnique=ownerRead});
