import {fitPastOnlyBlend,type BlendTrainingRow} from './past-only-blend';
/** Research-only jointly fitted weight and bias. Prior remains20 observations at weight.25 and bias0. */
export function fitPastOnlyAffineBlend(history:readonly BlendTrainingRow[],options:{season:number;round:number;type:'DRIVER'|'CONSTRUCTOR'}){
 const validated=fitPastOnlyBlend(history,options),rows=history.filter(r=>r.season===options.season&&r.type===options.type&&r.round<options.round);
 let sumD=0,sumD2=0,sumE=0,sumDE=0;for(const row of rows){const d=row.component-row.baseline,e=row.actual-row.baseline;sumD+=d;sumD2+=d*d;sumE+=e;sumDE+=d*e}
 const penalty=rows.length?20*sumD2/rows.length:0,a=sumD2+penalty,c=rows.length+20,det=a*c-sumD*sumD;
 if(![sumD,sumD2,sumE,sumDE,penalty,det].every(Number.isFinite))throw Error('Affine blend moment overflow');
 const weight=det>0?Math.max(0,Math.min(1,((sumDE+penalty*.25)*c-sumD*sumE)/det)):.25;
 const bias=(sumE-weight*sumD)/c;if(!Number.isFinite(weight)||!Number.isFinite(bias))throw Error('Nonfinite affine parameters');
 return {...validated,weight,bias};
}
