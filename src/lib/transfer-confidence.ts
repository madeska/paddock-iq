export type TransferConfidence='LOW'|'MEDIUM'|'HIGH';

export type SwapConfidence={
  type:'DRIVER'|'CONSTRUCTOR';
  predictedEdge:number;
  empiricalHitRate:number;
  label:TransferConfidence;
};

export function swapConfidence(type:'DRIVER'|'CONSTRUCTOR',predictedEdge:number):SwapConfidence{
  let empiricalHitRate:number;
  if(predictedEdge<=0){
    empiricalHitRate=.5;
  }else if(type==='DRIVER'){
    empiricalHitRate=predictedEdge<2?.509:
      predictedEdge<5?.614:
      predictedEdge<10?.657:
      predictedEdge<15?.795:.82;
  }else{
    empiricalHitRate=predictedEdge<2?.462:
      predictedEdge<5?.565:
      predictedEdge<10?.55:
      predictedEdge<15?.705:.869;
  }
  const label:TransferConfidence=empiricalHitRate>=.78?'HIGH':empiricalHitRate>=.65?'MEDIUM':'LOW';
  return {type,predictedEdge,empiricalHitRate,label};
}

export function scenarioConfidence(swaps:SwapConfidence[]){
  if(!swaps.length)return {label:null as TransferConfidence|null,empiricalHitRate:null as number|null};
  const weakest=swaps.reduce((a,b)=>b.empiricalHitRate<a.empiricalHitRate?b:a);
  return {label:weakest.label,empiricalHitRate:weakest.empiricalHitRate};
}
