import {FANTASY_RACES_2026} from '../src/lib/fantasy-race-calendar';
import {getWeekendLock,type OpenF1Session} from '../src/lib/openf1-weekend';
async function json(url:string){const response=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Paddock-IQ-calendar-check'}});if(!response.ok)throw Error('Calendar source HTTP '+response.status);return response.json()}
async function main(){
 const [calendar,sessions]=await Promise.all([json('https://f1fantasytools.com/api/statistics/2026'),json('https://api.openf1.org/v1/sessions?year=2026')]);
 if(!Array.isArray(calendar?.races)||!Array.isArray(sessions))throw Error('Calendar/provider schema invalid');
 const evidence={calendar:async()=>calendar,sessions:async()=>sessions as OpenF1Session[]};
 const fromRound=Number(process.argv.find(arg=>arg.startsWith('--from-round='))?.slice(13)??17);
 if(!Number.isInteger(fromRound)||fromRound<17||fromRound>23)throw Error('Choose --from-round between 17 and 23');
 // Derive expectations from our registry, never from whichever entries a source happens to return.
 const upcoming=FANTASY_RACES_2026.filter(race=>race.round>=fromRound);
 const results=[];
 for(const race of upcoming){const entries=calendar.races.filter((row:any)=>row.roundNumber===race.round);const lock=entries.length===1?await getWeekendLock(2026,race.round,race.name,null,evidence):null;results.push({round:race.round,name:race.name,ok:Boolean(lock),deadline:lock?.deadline.toISOString()??null})}
 console.log(JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));
 if(results.some(result=>!result.ok))process.exitCode=1;
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Live calendar check failed');process.exitCode=1});
