import assert from 'node:assert/strict';
import {test,mock} from 'node:test';
import {selectPracticeContext,getPracticeSnapshot,type OpenF1Session} from '../src/lib/openf1-weekend';
const deadline=new Date('2025-05-31T14:00:00Z');
const session=(key:number,name:string,start:string,end:string):OpenF1Session=>({year:2025,meeting_key:1,session_key:key,session_name:name,session_type:name.startsWith('Practice')?'Practice':name,date_start:start,date_end:end});
const fp2=session(2,'Practice 2','2025-05-30T15:00:00Z','2025-05-30T16:00:00Z'),fp3=session(3,'Practice 3','2025-05-31T10:30:00Z','2025-05-31T11:30:00Z'),q=session(4,'Qualifying','2025-05-31T14:00:00Z','2025-05-31T15:00:00Z');
test('latest completed practice is eligible before lock',()=>assert.deepEqual(selectPracticeContext([fp2,fp3,q],2025,deadline,deadline)?.practices.map(s=>s.session_key),[3,2]));
test('final results of a practice still in progress at forecast time cannot enter',()=>assert.deepEqual(selectPracticeContext([fp2,fp3,q],2025,deadline,new Date('2025-05-31T11:00:00Z'))?.practices.map(s=>s.session_key),[2]));
test('a practice starting before lock but ending after it is not eligible',()=>assert.deepEqual(selectPracticeContext([fp2,fp3,q],2025,new Date('2025-05-31T11:00:00Z'),deadline)?.practices.map(s=>s.session_key),[2]));
test('cancelled, malformed and other-season sessions are excluded',()=>{
 const bad=[{...fp3,is_cancelled:true},{...fp3,session_key:33,year:2026},{...fp3,session_key:34,date_end:'bad'}];assert.deepEqual(selectPracticeContext([fp2,...bad,q],2025,deadline,deadline)?.practices.map(s=>s.session_key),[2]);assert.equal(selectPracticeContext([q],2025,new Date('bad'),deadline),null);
});
test('sprint policy remains explicit and qualifying is never a practice',()=>{const sprint=session(5,'Sprint','2025-05-31T09:00:00Z','2025-05-31T10:00:00Z');const context=selectPracticeContext([fp2,q,sprint],2025,deadline,deadline);assert.equal(context?.isSprint,true);assert.ok(context?.practices.every(s=>s.session_type==='Practice'))});
test('live snapshot never queries an ineligible session result even if provider exposes it',async()=>{
 const requested:string[]=[];const fetchMock=mock.method(globalThis,'fetch',async(input:any)=>{const url=String(input);requested.push(url);let value:any=[];if(url.includes('/sessions?'))value=[fp2,fp3,q];else if(url.includes('/session_result?session_key=2'))value=[{driver_number:4,position:1}];else if(url.includes('/drivers?'))value=[{driver_number:4,name_acronym:'NOR'}];else if(url.includes('/session_result?session_key=3'))throw Error('future result queried');return new Response(JSON.stringify(value),{status:200})});
 try{const result=await getPracticeSnapshot(2025,deadline,new Date('2025-05-31T11:00:00Z'));assert.equal(result?.sessionKey,2);assert.equal(result?.positions.get('NOR'),1);assert.ok(!requested.some(url=>url.includes('session_key=3')))}finally{fetchMock.mock.restore()}
});
