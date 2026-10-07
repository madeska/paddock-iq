export type PointHistoryRow={season:number;round:number;code:string;type:'DRIVER'|'CONSTRUCTOR';team:string;actualPoints:number;sprint:boolean};
export type PointRoster={code:string;type:'DRIVER'|'CONSTRUCTOR';team:string};
export type PointHistoryOptions={season:number;round:number;sprint:boolean;alpha:number;ridge:number;sprintFactor:number};
const mean=(xs:number[])=>xs.length?xs.reduce((n,x)=>n+x,0)/xs.length:0;
const ewma=(xs:number[],alpha:number)=>xs.reduce((n,x,i)=>i?alpha*x+(1-alpha)*n:x,0);
export function fitPointHistoryRidge(rows:{x:number[];y:number}[],lambda:number){
 if(!rows.length)return null;
 const d=rows[0].x.length,centers=Array.from({length:d},(_,j)=>mean(rows.map(r=>r.x[j])));
 const scales=centers.map((m,j)=>Math.sqrt(mean(rows.map(r=>(r.x[j]-m)**2)))||1);
 const vectors=rows.map(r=>[1,...r.x.map((v,j)=>(v-centers[j])/scales[j])]),n=d+1;
 const matrix=Array.from({length:n},()=>Array(n+1).fill(0));
 vectors.forEach((x,i)=>{for(let a=0;a<n;a++){matrix[a][n]+=x[a]*rows[i].y;for(let b=0;b<n;b++)matrix[a][b]+=x[a]*x[b]}});
 for(let j=1;j<n;j++)matrix[j][j]+=lambda;
 for(let i=0;i<n;i++){let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(matrix[j][i])>Math.abs(matrix[pivot][i]))pivot=j;[matrix[i],matrix[pivot]]=[matrix[pivot],matrix[i]];const divisor=matrix[i][i];if(Math.abs(divisor)<1e-10)return null;
  for(let k=i;k<=n;k++)matrix[i][k]/=divisor;for(let j=0;j<n;j++)if(j!==i){const factor=matrix[j][i];for(let k=i;k<=n;k++)matrix[j][k]-=factor*matrix[i][k]}
 }
 const beta=matrix.map(r=>r[n]);return (x:number[])=>beta[0]+x.reduce((n,v,j)=>n+beta[j+1]*(v-centers[j])/scales[j],0);
}
/** Research-only price-free point-history model. Each training feature uses earlier rounds only. */
export function forecastPointHistory(history:PointHistoryRow[],roster:PointRoster[],options:PointHistoryOptions):Record<string,number>{
 const {season,round,alpha,ridge,sprintFactor}=options;
 if(!Number.isInteger(season)||!Number.isInteger(round)||round<1||!Number.isFinite(alpha)||alpha<=0||alpha>1||!Number.isFinite(ridge)||ridge<=0||!Number.isFinite(sprintFactor)||sprintFactor<1||typeof options.sprint!=='boolean')throw Error('Invalid point model options');
 if(new Set(roster.map(r=>r.code)).size!==roster.length)throw Error('Duplicate point roster');
 const unique=new Map<string,PointHistoryRow>();for(const row of history){if(row.season!==season||row.round>=round)continue;if(!Number.isInteger(row.round)||row.round<1||!Number.isFinite(row.actualPoints)||typeof row.sprint!=='boolean')throw Error('Invalid point history');const key=row.type+':'+row.code+':'+row.round;if(unique.has(key))throw Error('Duplicate point history');unique.set(key,row)}
 const rows=[...unique.values()].sort((a,b)=>a.round-b.round||a.type.localeCompare(b.type)||a.code.localeCompare(b.code));
 const normalized=(r:PointHistoryRow)=>r.actualPoints/(r.sprint?sprintFactor:1);
 function features(asset:PointRoster,before:number){
  const past=rows.filter(r=>r.round<before),own=past.filter(r=>r.type===asset.type&&r.code===asset.code).map(normalized);
  const byRound=new Map<number,number[]>();for(const r of past.filter(r=>r.type==='DRIVER'&&r.team===asset.team)){const values=byRound.get(r.round)??[];values.push(normalized(r));byRound.set(r.round,values)}
  const teamScores=[...byRound.entries()].sort((a,b)=>a[0]-b[0]).map(([,scores])=>mean(scores));
  const global=mean(past.filter(r=>r.type===asset.type).map(normalized)),team=teamScores.length?ewma(teamScores,alpha):asset.type==='DRIVER'?global:global/2;
  const center=asset.type==='DRIVER'?team:global,level=own.length?ewma(own,alpha):center,long=own.length?mean(own):center;
  return {n:own.length,fallback:level,x:[level,own.length?mean(own.slice(-3)):center,long,team,level-long,Math.sqrt(mean(own.map(x=>(x-long)**2))),own.length/(own.length+5)]};
 }
 const result:Record<string,number>={};
 for(const type of ['DRIVER','CONSTRUCTOR'] as const){
  const training=rows.filter(r=>r.type===type).map(r=>({f:features(r,r.round),y:normalized(r)})).filter(r=>r.f.n>=2).map(r=>({x:r.f.x,y:r.y}));
  const predictor=training.length>=20?fitPointHistoryRidge(training,ridge):null;
  for(const asset of [...roster].filter(r=>r.type===type).sort((a,b)=>a.code.localeCompare(b.code))){const f=features(asset,round);const expected=f.n===0?f.fallback:predictor?.(f.x)??f.fallback;const value=expected*(options.sprint?sprintFactor:1);if(!Number.isFinite(value))throw Error('Nonfinite point prediction');result[asset.code]=value}
 }
 // Canonical output order keeps audit comparisons independent of roster ordering.
 return Object.fromEntries(Object.entries(result).sort(([a],[b])=>a.localeCompare(b)));
}
