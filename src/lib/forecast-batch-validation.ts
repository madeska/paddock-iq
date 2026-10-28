import {CURRENT_DRIVER_MODEL,CURRENT_CONSTRUCTOR_MODEL,BOOST_MODELS} from './current-prediction-models';
export type ForecastAsset={id:string;type:'DRIVER'|'CONSTRUCTOR';currentPrice:number|null};
type Row={assetId:string;grandPrixId:string;modelVersion:string;expectedPoints?:number|null;expectedPriceDelta?:number|null;probabilityMaxFall?:number|null;probabilitySmallFall?:number|null;probabilitySmallRise?:number|null;probabilityMaxRise?:number|null};
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
export function validateForecastBatch(assets:readonly ForecastAsset[],grandPrixId:string,rows:readonly Row[]){
 const issues:string[]=[],ids=new Set(assets.map(asset=>asset.id));
 if(!assets.length||ids.size!==assets.length)issues.push('Invalid active asset set');
 if(rows.some(row=>!ids.has(row.assetId)||row.grandPrixId!==grandPrixId))issues.push('Wrong asset or round identity');
 for(const asset of assets){
  const model=asset.type==='DRIVER'?CURRENT_DRIVER_MODEL:CURRENT_CONSTRUCTOR_MODEL;
  const own=rows.filter(row=>row.assetId===asset.id),main=own.filter(row=>row.modelVersion===model),boost=own.filter(row=>BOOST_MODELS.includes(row.modelVersion));
  if(main.length!==1){issues.push('Missing or duplicate main forecast');continue}
  const row=main[0];
  if(!finite(row.expectedPoints)||!finite(row.expectedPriceDelta))issues.push('Nonfinite main forecast');
  if(!finite(asset.currentPrice)||asset.currentPrice<3||asset.currentPrice>34)issues.push('Invalid current price');
  else if(finite(row.expectedPriceDelta)&&(asset.currentPrice+row.expectedPriceDelta<2.999||asset.currentPrice+row.expectedPriceDelta>34.001))issues.push('Price change outside bounds');
  const probabilities=[row.probabilityMaxFall,row.probabilitySmallFall,row.probabilitySmallRise,row.probabilityMaxRise];
  if(probabilities.some(p=>!finite(p)||p<0||p>1)||Math.abs(probabilities.reduce<number>((sum,p)=>sum+(p??0),0)-1)>.0021)issues.push('Invalid price probabilities');
  if(asset.type==='DRIVER'&&(boost.length!==1||!finite(boost[0]?.expectedPoints)))issues.push('Missing or invalid driver boost');
  if(asset.type==='CONSTRUCTOR'&&boost.length)issues.push('Unexpected constructor boost');
  if(own.length!==(asset.type==='DRIVER'?2:1))issues.push('Unexpected prediction rows');
 }
 return issues;
}
