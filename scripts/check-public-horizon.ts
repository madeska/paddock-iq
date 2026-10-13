import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';

test('public horizon validates before database access and hides unexpected failures',async()=>{
 let queries=0;
 (globalThis as any).prisma={grandPrix:{findUnique:async()=>{queries++;throw Error('private database host and query')}}};
 const {GET}=await import('../src/app/api/predictions/horizon/route');
 for(const query of ['season=NaN','round=0','round=1.5','length=10','length=NaN']){
  assert.equal((await GET(new NextRequest('https://paddock.example/api/predictions/horizon?'+query))).status,400);
 }
 assert.equal(queries,0);
 const response=await GET(new NextRequest('https://paddock.example/api/predictions/horizon?season=2026&round=18&length=3'));
 assert.equal(response.status,500);
 assert.deepEqual(await response.json(),{error:'Forecast unavailable. Please try again later.'});
 assert.equal(queries,1);
});
