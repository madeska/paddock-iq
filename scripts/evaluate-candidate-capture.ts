import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {evaluateCandidateCapture} from '../src/lib/candidate-evaluation';
async function main(){
 const file=process.argv[2];if(!file)throw Error('Usage: npx tsx scripts/evaluate-candidate-capture.ts CAPTURE_FILE [EXPECTED_SHA256]');
 const raw=await readFile(file),sha256=createHash('sha256').update(raw).digest('hex');if(process.argv[3]&&process.argv[3]!==sha256)throw Error('Capture hash mismatch');
 const capture=JSON.parse(raw.toString()),origin=new URL(process.env.PADDOCK_BASE_URL??'http://localhost:3000');
 const response=await fetch(new URL('/api/market?season='+capture.season+'&round='+capture.round,origin),{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Market HTTP '+response.status);
 const market=await response.json(),evaluation=evaluateCandidateCapture(capture,market);
 console.log(JSON.stringify({...evaluation,captureSHA256:sha256,evaluatedAt:new Date().toISOString(),actualUpdatedAt:market.assets.map((a:any)=>({code:a.code,updatedAt:a.actualPointsUpdatedAt??null})),note:'Uses the saved paired forecasts without recalculation. Published official scores may receive later corrections.'},null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1});
