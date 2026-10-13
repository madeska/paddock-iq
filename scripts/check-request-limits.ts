import {test} from 'node:test';import assert from 'node:assert/strict';
import {readLimitedJson} from '../src/lib/request-json';
test('request byte limit applies to actual UTF-8 bytes, not the declared length',async()=>{
 await assert.rejects(()=>readLimitedJson(new Request('https://example.test',{method:'POST',headers:{'content-length':'1'},body:JSON.stringify({text:'я'.repeat(80)})}),100),/too large/);
 assert.deepEqual(await readLimitedJson(new Request('https://example.test',{method:'POST',body:'{"points":0}'})),{points:0});
});
