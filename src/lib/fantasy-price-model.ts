export type PriceTier='A'|'B';
export type PriceProbabilityInput={currentPrice:number;previousFantasyPoints:[number,number];expectedPoints:number;pointsStdDev?:number};
export type PriceProbability={tier:PriceTier;expectedDelta:number;mostLikelyDelta:number;probabilities:Record<string,number>;thresholds:{maxFallBelow:number;smallRiseAt:number;maxRiseAt:number}};
const erf=(x:number)=>{const s=x<0?-1:1,a=Math.abs(x),t=1/(1+.3275911*a);return s*(1-(((((1.061405429*t-1.453152027)*t+1.421413741)*t-0.284496736)*t+.254829592)*t)*Math.exp(-a*a))};
const cdf=(x:number,mu:number,sd:number)=>.5*(1+erf((x-mu)/(sd*Math.sqrt(2))));
const round=(n:number,d=3)=>Math.round(n*10**d)/10**d;
export function predictFantasyPrice(i:PriceProbabilityInput):PriceProbability{
 const tier:PriceTier=i.currentPrice>=18.5?'A':'B', [p1,p2]=i.previousFantasyPoints, sum=p1+p2;
 const threshold=(ppm:number)=>3*i.currentPrice*ppm-sum;
 const t06=threshold(.6),t09=threshold(.9),t12=threshold(1.2);
 const sd=Math.max(4,i.pointsStdDev??Math.max(6,Math.abs(i.expectedPoints)*.35));
 const pMaxFall=cdf(t06,i.expectedPoints,sd);
 const pSmallFall=Math.max(0,cdf(t09,i.expectedPoints,sd)-pMaxFall);
 const pSmallRise=Math.max(0,cdf(t12,i.expectedPoints,sd)-cdf(t09,i.expectedPoints,sd));
 const pMaxRise=Math.max(0,1-cdf(t12,i.expectedPoints,sd));
 const deltas=tier==='A'?[-.3,-.1,.1,.3]:[-.6,-.2,.2,.6];
 const probs=[pMaxFall,pSmallFall,pSmallRise,pMaxRise];
 const expectedDelta=round(probs.reduce((s,p,k)=>s+p*deltas[k],0),2);
 const idx=probs.indexOf(Math.max(...probs));
 return {tier,expectedDelta,mostLikelyDelta:deltas[idx],probabilities:{maxFall:round(pMaxFall),smallFall:round(pSmallFall),smallRise:round(pSmallRise),maxRise:round(pMaxRise)},thresholds:{maxFallBelow:round(t06,1),smallRiseAt:round(t09,1),maxRiseAt:round(t12,1)}};
}
