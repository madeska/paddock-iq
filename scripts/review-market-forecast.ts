/** Read-only diagnostic: saved market forecast versus independently verified official totals. */
async function main(){
 const season=Number(process.argv[2]??2026),round=Number(process.argv[3]);
 if(!Number.isInteger(season)||!Number.isInteger(round)||round<1)throw Error('Usage: npx tsx scripts/review-market-forecast.ts SEASON ROUND');
 const origin=new URL(process.env.PADDOCK_BASE_URL??'http://localhost:3000');
 const response=await fetch(new URL('/api/market?season='+season+'&round='+round,origin),{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Market HTTP '+response.status);
 const market=await response.json();
 if(market.season!==season||market.round!==round||!Array.isArray(market.assets))throw Error('Market identity mismatch');
 const rows=market.assets.filter((a:any)=>typeof a.expectedPoints==='number'&&Number.isFinite(a.expectedPoints)&&typeof a.actualPoints==='number'&&Number.isFinite(a.actualPoints)).map((a:any)=>({code:a.code,type:a.type,forecast:a.expectedPoints,actual:a.actualPoints,error:Number((a.expectedPoints-a.actualPoints).toFixed(4)),forecastCreatedAt:a.forecastCreatedAt??null,forecastSource:a.forecastSource??null,actualUpdatedAt:a.actualPointsUpdatedAt??null,modelVersion:a.modelVersion??null}));
 const metrics=(items:typeof rows)=>items.length?{count:items.length,mae:items.reduce((s:number,a:any)=>s+Math.abs(a.error),0)/items.length,rmse:Math.sqrt(items.reduce((s:number,a:any)=>s+a.error**2,0)/items.length),bias:items.reduce((s:number,a:any)=>s+a.error,0)/items.length}:null;
 console.log(JSON.stringify({season,round,event:market.grandPrix,capturedAt:new Date().toISOString(),interpretation:'Descriptive review of currently saved forecasts. No immutable pre-lock capture receipt is asserted; a single race cannot establish model improvement.',coverage:{evaluated:rows.length,total:market.assets.length,missing:market.assets.filter((a:any)=>!rows.some((r:any)=>r.code===a.code)).map((a:any)=>a.code)},metrics:{all:metrics(rows),drivers:metrics(rows.filter((r:any)=>r.type==='DRIVER')),constructors:metrics(rows.filter((r:any)=>r.type==='CONSTRUCTOR'))},largestErrors:[...rows].sort((a:any,b:any)=>Math.abs(b.error)-Math.abs(a.error)).slice(0,10),assets:rows},null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1});
