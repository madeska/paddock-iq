import {test,mock} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {NextRequest} from 'next/server';
const require=createRequire(import.meta.url);
test('team API requires a server session, ignores supplied identity and rejects foreign teams and cross-origin writes',async()=>{
 process.env.GOOGLE_CLIENT_ID='test';process.env.GOOGLE_CLIENT_SECRET='test';process.env.NEXTAUTH_SECRET='test-only-secret-not-for-deployment';process.env.NEXTAUTH_URL='http://localhost:3000';
 let session:any=null,queries=0;
 const user={id:'owner',email:'owner@gmail.com',googleSubject:'google-owner',teams:[{id:'own-team',season:2026,name:'Own team'}]};
 const db:any={user:{findUnique:async({where}:any)=>{queries++;assert.equal(where.id,'owner');return user}},fantasyTeam:{findFirst:async({where}:any)=>{queries++;assert.equal(where.userId,'owner');return null}}};db.$transaction=async(fn:any)=>fn(db);(globalThis as any).prisma=db;
 const mocked=mock.method(require('next-auth/next'),'getServerSession',async()=>session);
 try{
 const team=await import('../src/app/api/team/route');const manage=await import('../src/app/api/team/manage/route');const manual=await import('../src/app/api/team/import/route');const f1=await import('../src/app/api/team/f1/import/route');
 const req=(method:string,path:string,body:any={})=>new NextRequest('http://localhost:3000'+path,{method,headers:{origin:'http://localhost:3000','content-type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})});
 assert.equal((await team.GET(req('GET','/api/team?email=victim@gmail.com'))).status,401);
 for(const handler of [manage.PATCH,manage.DELETE,manual.POST,f1.POST])assert.equal((await handler(req('POST','/api/team',{email:'victim@gmail.com',teamId:'foreign'}))).status,401);
 assert.equal(queries,0);session={ownerId:'owner'};
 assert.equal((await team.GET(req('GET','/api/team?email=victim@gmail.com&teamId=foreign'))).status,404);
 assert.equal((await manage.DELETE(req('DELETE','/api/team/manage',{email:'victim@gmail.com',teamId:'foreign'}))).status,404);
 assert.equal((await manual.POST(new NextRequest('http://localhost:3000/api/team/import',{method:'POST',headers:{origin:'https://evil.example'},body:'{}'}))).status,403);
 }finally{mocked.mock.restore()}
});
