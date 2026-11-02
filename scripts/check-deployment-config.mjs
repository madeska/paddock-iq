import {test} from 'node:test';import assert from 'node:assert/strict';import {deploymentProblems} from './check-deployment-env.mjs';
const valid={DATABASE_URL:'postgresql://user:secret@database.example/db?sslmode=require',NEXTAUTH_URL:'https://paddock.example',NEXTAUTH_SECRET:'s'.repeat(32),GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret',ADMIN_EMAILS:'owner@example.com'};
test('production requires database, HTTPS origin, OAuth and owner configuration',()=>{
 assert.deepEqual(deploymentProblems(valid),[]);assert.ok(deploymentProblems({}).length>=6);
 for(const url of ['http://localhost:3000','https://paddock.example/my-team','https://user:password@paddock.example'])assert.ok(deploymentProblems({...valid,NEXTAUTH_URL:url}).some(error=>error.includes('NEXTAUTH_URL')));
 assert.ok(deploymentProblems({...valid,MARKET_ADMIN_KEY:'change-me'}).some(error=>error.includes('MARKET_ADMIN_KEY')));
});
