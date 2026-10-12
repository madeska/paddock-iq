import {fitPointHistoryRidge,type PointHistoryRow,type PointRoster} from './point-history-model';
const mean=(xs:number[])=>xs.length?xs.reduce((n,x)=>n+x,0)/xs.length:0;
const ewma=(xs:number[])=>xs.reduce((n,x,i)=>i?.25*x+.75*n:x,0);
/** Current score-history baseline with its price feature omitted, not exact production. */
export function priceFreeHistoricalBaseline(history:PointHistoryRow[],roster:PointRoster[],options:{season:number;round:number}):Record<string,number>{
 if(!Number.isInteger(options.season)||!Number.isInteger(options.round)||options.round<1)throw Error('Invalid reference cutoff');
 const past=history.filter(r=>r.season===options.season&&r.round<options.round).sort((a,b)=>a.round-b.round||a.code.localeCompare(b.code));
 const seen=new Set<string>();for(const row of past){const key=row.type+':'+row.code+':'+row.round;if(seen.has(key)||!Number.isFinite(row.actualPoints))throw Error('Invalid reference history');seen.add(key)}
 const own=(code:string,type:string,before:number)=>past.filter(r=>r.code===code&&r.type===type&&r.round<before).map(r=>r.actualPoints);
 const training=past.filter(r=>r.type==='DRIVER'&&r.round>=3).flatMap(r=>{const scores=own(r.code,r.type,r.round);return scores.length>=2?[{x:[ewma(scores),mean(scores)],y:r.actualPoints}]:[]});
 const ridge=fitPointHistoryRidge(training,50),output:Record<string,number>={};
 for(const asset of [...roster].sort((a,b)=>a.code.localeCompare(b.code))){const scores=own(asset.code,asset.type,options.round),e=ewma(scores);output[asset.code]=asset.type==='DRIVER'?.5*(ridge?.([e,mean(scores)])??e)+.5*e:.5*e+.5*mean(scores.slice(-3));if(!Number.isFinite(output[asset.code]))throw Error('Nonfinite reference forecast')}
 return output;
}
