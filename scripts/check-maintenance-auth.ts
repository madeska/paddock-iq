import {test,mock} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {NextRequest} from 'next/server';
const require=createRequire(import.meta.url);
test('shared mutations and diagnostics require admin access before database work',async()=>{
 Object.assign(process.env,{GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',NEXTAUTH_SECRET:'test-only',NEXTAUTH_URL:'https://paddock.example',ADMIN_EMAILS:'admin@example.com',MARKET_ADMIN_KEY:'test-admin-key'});
 let session:any=null,queries=0;
 const db:any={user:{findUnique:async()=>({id:'owner',email:'user@example.com',googleSubject:'verified'})},forecastSeasonState:{upsert:async()=>{queries++;throw Error('should not be queried')}},asset:{findMany:async()=>{queries++;throw Error('should not be queried')}}};(globalThis as any).prisma=db;
 const mocked=mock.method(require('next-auth/next'),'getServerSession',async()=>session);
 try{
 const auth=await import('../src/lib/auth');const automatic=await import('../src/app/api/predictions/auto/route');const manual=await import('../src/app/api/predictions/route');const scores=await import('../src/app/api/fantasy-scores/sync/route');const health=await import('../src/app/api/db/health/route');const one=await import('../src/app/api/optimize/route');const horizon=await import('../src/app/api/optimize/horizon/route');
 const req=(path:string,headers:Record<string,string>={})=>new NextRequest('https://paddock.example'+path,{method:'POST',headers:{origin:'https://paddock.example',...headers},body:'{}'});
 for(const handler of [automatic.POST,manual.POST,scores.POST,one.POST,horizon.POST])assert.equal((await handler(req('/api'))).status,401);
 assert.equal((await health.GET(new NextRequest('https://paddock.example/api/db/health'))).status,401);assert.equal(queries,0);
 session={ownerId:'owner'};assert.equal((await auth.authorizeMaintenanceRequest(req('/api')))?.status,403);
 db.user.findUnique=async()=>({id:'owner',email:'admin@example.com',googleSubject:'verified'});
 assert.equal(await auth.authorizeMaintenanceRequest(req('/api')),null);
 assert.equal((await auth.authorizeMaintenanceRequest(req('/api',{origin:'https://other.example'})))?.status,403);
 session=null;assert.equal(await auth.authorizeMaintenanceRequest(req('/api',{'x-market-admin-key':'test-admin-key'})),null);
 let release!:()=>void,started!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve}),ready=new Promise<void>(resolve=>{started=resolve});
 db.forecastSeasonState.upsert=async()=>{started();await gate;return {season:2026,round:18,completed:true}};
 const pending=automatic.POST(req('/api',{'x-market-admin-key':'test-admin-key'}));await ready;
 assert.equal((await automatic.POST(req('/api',{'x-market-admin-key':'test-admin-key'}))).status,409);
 release();assert.equal((await pending).status,409);
 }finally{mocked.mock.restore()}
});
