export type BlendTrainingRow={season:number;round:number;code:string;type:'DRIVER'|'CONSTRUCTOR';baseline:number;component:number;actual:number};
/** Research-only convex stacking with a fixed20-observation incumbent prior. Caller must supply genuinely past-only forecast features. */
export function fitPastOnlyBlend(history:readonly BlendTrainingRow[],options:{season:number;round:number;type:'DRIVER'|'CONSTRUCTOR'}){
 if(!Number.isInteger(options.season)||!Number.isInteger(options.round)||options.round<1||!['DRIVER','CONSTRUCTOR'].includes(options.type))throw Error('Invalid blend cutoff');
 const rows=history.filter(r=>r.season===options.season&&r.type===options.type&&r.round<options.round),seen=new Set<string>();let contrast=0,cross=0;
 for(const row of rows){if(!Number.isInteger(row.round)||row.round<1||!row.code||seen.has(row.code+':'+row.round)||![row.baseline,row.component,row.actual].every(Number.isFinite))throw Error('Invalid blend training row');seen.add(row.code+':'+row.round);const d=row.component-row.baseline;contrast+=d*d;cross+=d*(row.actual-row.baseline)}
 if(!Number.isFinite(contrast)||!Number.isFinite(cross))throw Error('Blend moment overflow');
 const penalty=rows.length?20*contrast/rows.length:0;
 const weight=contrast>0?Math.max(0,Math.min(1,(cross+penalty*.25)/(contrast+penalty))):.25;
 if(!Number.isFinite(weight))throw Error('Nonfinite blend weight');
 return {weight,trainingRows:rows.length,sourceRounds:[...new Set(rows.map(r=>r.round))].sort((a,b)=>a-b),priorWeight:.25,priorObservations:20};
}
