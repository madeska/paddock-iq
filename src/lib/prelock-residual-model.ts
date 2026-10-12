import {fitPointHistoryRidge} from './point-history-model';
export type PrelockResidualFrame={season:number;round:number;code:string;type:'DRIVER'|'CONSTRUCTOR';baseline:number;features:number[];actualPoints?:number};
/** Research only: pooled residuals use past labels, with shrinking toward the incumbent. */
export function forecastPrelockResidual(history:readonly PrelockResidualFrame[],roster:readonly PrelockResidualFrame[],options:{season:number;round:number;ridge:number;weight:number}){
 if(!Number.isInteger(options.season)||!Number.isInteger(options.round)||options.round<1||!Number.isFinite(options.ridge)||options.ridge<=0||!Number.isFinite(options.weight)||options.weight<0||options.weight>1)throw Error('Invalid pre-lock residual options');
 if(!roster.length)return [];
 const dimension=roster[0]?.features.length??0,validate=(row:PrelockResidualFrame)=>{if(!Number.isFinite(row.baseline)||!row.features.length||row.features.length!==dimension||row.features.some(x=>!Number.isFinite(x)))throw Error('Invalid residual feature frame')};
 const seen=new Set<string>();for(const row of roster){if(row.season!==options.season||row.round!==options.round||seen.has(row.type+':'+row.code))throw Error('Invalid residual target roster');seen.add(row.type+':'+row.code);validate(row)}
 const past:PrelockResidualFrame[]=[],seenPast=new Set<string>();
 for(const row of history){
  if(row.season!==options.season||row.round>=options.round||row.actualPoints==null)continue;
  if(!Number.isInteger(row.round)||row.round<1||!Number.isFinite(row.actualPoints))throw Error('Invalid residual history');validate(row);
  const key=row.type+':'+row.code+':'+row.round;if(seenPast.has(key))throw Error('Duplicate residual history');seenPast.add(key);past.push(row);
 }
 return roster.map(row=>{
  const training=past.filter(r=>r.type===row.type),rounds=new Set(training.map(r=>r.round));
  const predictor=rounds.size>=2&&training.length>=20?fitPointHistoryRidge(training.map(r=>({x:r.features,y:r.actualPoints!-r.baseline})),options.ridge):null;
  const prediction=row.baseline+options.weight*(predictor?.(row.features)??0);if(!Number.isFinite(prediction))throw Error('Nonfinite residual forecast');
  return {code:row.code,type:row.type,prediction:Math.round(prediction*10)/10,trainingRows:training.length};
 });
}
