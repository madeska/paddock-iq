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


export function packageConfidence(transfers:number,predictedEdge:number){
  if(transfers<=0)return {label:null as TransferConfidence|null,empiricalHitRate:null as number|null};

  const bin=predictedEdge<2?0:predictedEdge<5?1:predictedEdge<10?2:predictedEdge<15?3:4;
  const ratesBySize:Record<number,number[]> = {
    1:[.507,.612,.649,.783,.838],
    2:[.499,.551,.616,.681,.838],
    3:[.513,.547,.595,.655,.856],
  };
  const rates=ratesBySize[Math.min(3,Math.max(1,transfers))];
  const empiricalHitRate=rates[bin];
  const label:TransferConfidence=empiricalHitRate>=.78?'HIGH':empiricalHitRate>=.65?'MEDIUM':'LOW';
  return {label,empiricalHitRate};
}


export function horizonPackageConfidence(transfers:number,predictedThreeGpEdge:number){
  if(transfers<=0)return {label:null as TransferConfidence|null,empiricalHitRate:null as number|null};

  const bin=predictedThreeGpEdge<5?0:
    predictedThreeGpEdge<10?1:
    predictedThreeGpEdge<15?2:
    predictedThreeGpEdge<25?3:4;

  const ratesBySize:Record<number,number[]> = {
    1:[.612,.719,.735,.747,.949],
    2:[.564,.661,.683,.734,.896],
    3:[.544,.611,.643,.672,.877],
  };

  const rates=ratesBySize[Math.min(3,Math.max(1,transfers))];
  const empiricalHitRate=rates[bin];
  const label:TransferConfidence=empiricalHitRate>=.78?'HIGH':empiricalHitRate>=.65?'MEDIUM':'LOW';
  return {label,empiricalHitRate};
}


export function horizonRecommendationConfidence(predictedNetGain:number){
  if(predictedNetGain<=0)return {label:null as TransferConfidence|null,empiricalHitRate:null as number|null};

  // Calibrated on optimizer-selected 3-GP recommendations from 2026 R7-R13
  // using 168 strong deterministic synthetic lineups under the live $130M / 2 FT setup.
  // Coarse bins intentionally avoid overfitting the small low-edge samples.
  const empiricalHitRate=predictedNetGain<20?.586:
    predictedNetGain<40?.757:.875;

  const label:TransferConfidence=empiricalHitRate>=.78?'HIGH':empiricalHitRate>=.65?'MEDIUM':'LOW';
  return {label,empiricalHitRate};
}
