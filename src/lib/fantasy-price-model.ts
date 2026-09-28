export type PriceTier='A'|'B';
export type PriceProbabilityInput={currentPrice:number;previousFantasyPoints:[number,number];expectedPoints:number;pointsStdDev?:number};
export type PriceProbability={
 tier:PriceTier;
 expectedDelta:number;
 mostLikelyDelta:number;
 probabilityFlat:number;
 probabilities:{maxFall:number;smallFall:number;smallRise:number;maxRise:number};
 effectiveDeltas:{maxFall:number;smallFall:number;smallRise:number;maxRise:number};
 thresholds:{maxFallBelow:number;smallRiseAt:number;maxRiseAt:number};
};
const erf=(x:number)=>{const s=x<0?-1:1,a=Math.abs(x),t=1/(1+.3275911*a);return s*(1-(((((1.061405429*t-1.453152027)*t+1.421413741)*t-0.284496736)*t+.254829592)*t)*Math.exp(-a*a))};
const cdf=(x:number,mu:number,sd:number)=>.5*(1+erf((x-mu)/(sd*Math.sqrt(2))));
const round=(n:number,d=3)=>Math.round(n*10**d)/10**d;
export function predictFantasyPrice(i:PriceProbabilityInput):PriceProbability{
 const tier:PriceTier=i.currentPrice>=18.5?'A':'B', [p1,p2]=i.previousFantasyPoints, sum=p1+p2;
 const threshold=(ppm:number)=>3*i.currentPrice*ppm-sum;
 const t06=threshold(.6),t09=threshold(.9),t12=threshold(1.2);
 const sd=Math.max(4,i.pointsStdDev??Math.max(6,Math.abs(i.expectedPoints)*.35));
 const raw={
  maxFall:cdf(t06,i.expectedPoints,sd),
  smallFall:Math.max(0,cdf(t09,i.expectedPoints,sd)-cdf(t06,i.expectedPoints,sd)),
  smallRise:Math.max(0,cdf(t12,i.expectedPoints,sd)-cdf(t09,i.expectedPoints,sd)),
  maxRise:Math.max(0,1-cdf(t12,i.expectedPoints,sd)),
 };
 const base=tier==='A'?{maxFall:-.3,smallFall:-.1,smallRise:.1,maxRise:.3}:{maxFall:-.6,smallFall:-.2,smallRise:.2,maxRise:.6};
 const floorDelta=round(3-i.currentPrice,2);
 const effectiveDeltas={
  maxFall:round(Math.max(base.maxFall,floorDelta),2),
  smallFall:round(Math.max(base.smallFall,floorDelta),2),
  smallRise:base.smallRise,
  maxRise:base.maxRise,
 };
 const probabilityFlat=round(
  (effectiveDeltas.maxFall===0?raw.maxFall:0)+(effectiveDeltas.smallFall===0?raw.smallFall:0)
 );
 const expectedDelta=round(
  raw.maxFall*effectiveDeltas.maxFall+
  raw.smallFall*effectiveDeltas.smallFall+
  raw.smallRise*effectiveDeltas.smallRise+
  raw.maxRise*effectiveDeltas.maxRise,2
 );
 const candidates=[
  {p:raw.maxFall,d:effectiveDeltas.maxFall},
  {p:raw.smallFall,d:effectiveDeltas.smallFall},
  {p:raw.smallRise,d:effectiveDeltas.smallRise},
  {p:raw.maxRise,d:effectiveDeltas.maxRise},
 ];
 const byDelta=new Map<number,number>();
 for(const c of candidates)byDelta.set(c.d,(byDelta.get(c.d)??0)+c.p);
 const mostLikely=[...byDelta.entries()].sort((a,b)=>b[1]-a[1])[0]??[0,0];
 return {
  tier,
  expectedDelta,
  mostLikelyDelta:mostLikely[0],
  probabilityFlat,
  probabilities:{maxFall:round(raw.maxFall),smallFall:round(raw.smallFall),smallRise:round(raw.smallRise),maxRise:round(raw.maxRise)},
  effectiveDeltas,
  thresholds:{maxFallBelow:round(t06,1),smallRiseAt:round(t09,1),maxRiseAt:round(t12,1)}
 };
}
