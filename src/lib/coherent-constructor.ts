/** Research-only: expected constructor extras = its simulated total minus simulated totals of its two drivers. */
export function coherentConstructorForecast(predictions:ReadonlyMap<string,number>,drivers:readonly {code:string;total:number}[],constructors:readonly {code:string;total:number}[],teams:Readonly<Record<string,string>>){
 for(const rows of [drivers,constructors]){const seen=new Set<string>();for(const row of rows){if(!row.code||seen.has(row.code)||!Number.isFinite(row.total))throw Error('Invalid component identity/total');seen.add(row.code)}}
 for(const value of predictions.values())if(!Number.isFinite(value))throw Error('Invalid driver prediction');
 const result=new Map<string,number>();for(const c of constructors){const pair=drivers.filter(d=>Object.hasOwn(teams,d.code)&&teams[d.code]===c.code);if(pair.length!==2||pair.some(d=>!predictions.has(d.code)))continue;const value=pair.reduce((n,d)=>n+predictions.get(d.code)!,0)+c.total-pair.reduce((n,d)=>n+d.total,0);if(!Number.isFinite(value))throw Error('Nonfinite coherent forecast');result.set(c.code,value)}
 return result;
}
