import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readApiJson} from '../src/lib/api-response';
import {databaseConnectionUnavailable} from '../src/lib/database-availability';
test('empty server errors identify the failed endpoint without a JSON parser error',async()=>{
 const response=new Response('',{status:500});
 await assert.rejects(()=>readApiJson(response),/Server error \(HTTP 500\)/);
});
test('HTML errors are never displayed as JSON parsing failures or raw markup',async()=>{
 await assert.rejects(()=>readApiJson(new Response('<!DOCTYPE html><html>internal</html>',{status:502})),/Server error \(HTTP 502\)/);
});
test('valid API errors and successful zero/negative data are preserved',async()=>{
 assert.deepEqual(await readApiJson(new Response('{"error":"Database unavailable"}',{status:503})),{error:'Database unavailable'});
 assert.deepEqual(await readApiJson(new Response('{"points":0,"delta":-1}')),{points:0,delta:-1});
});
test('invalid successful responses ask to retry, without logging response contents',async()=>{
 await assert.rejects(()=>readApiJson(new Response('')),/Invalid server response/);
 await assert.rejects(()=>readApiJson(new Response('not-json')),/Invalid server response/);
});
test('Prisma initialization and request connection errors use their respective code fields',()=>{
 assert.equal(databaseConnectionUnavailable({errorCode:'P1001'}),true);
 assert.equal(databaseConnectionUnavailable({code:'P1002'}),true);
 assert.equal(databaseConnectionUnavailable({code:'P1017'}),true);
 assert.equal(databaseConnectionUnavailable({code:'P2002'}),false);
 assert.equal(databaseConnectionUnavailable(null),false);
});
