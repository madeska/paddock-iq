import type {ComponentObservation} from './component-calibration';
export type OvertakeModel={season:number;beforeRound:number;trainingSessions:number;coefficients:number[];pace:Record<string,number>;failedMean:Record<string,number>;globalFailedMean:number};
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
function paceFor(rows:ComponentObservation[],code:string){
 const positions=rows.filter(o=>o.code===code&&o.qualifying?.position!=null&&!o.qualifying.noTime).map(o=>o.qualifying!.position!);
 // A five-session pooled prior prevents a single qualifying result dominating pace.
 return (11.5-(positions.reduce((a,b)=>a+b,0)+5*11.5)/(positions.length+5))/6;
}
function features(start:number,pace:number){const grid=(clamp(start,1,22)-11.5)/10.5;return [1,grid,pace,grid*pace]}
function solve(matrix:number[][],vector:number[]){
 const m=matrix.map((r,i)=>[...r,vector[i]]),n=vector.length;
 for(let i=0;i<n;i++){
  let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(m[j][i])>Math.abs(m[pivot][i]))pivot=j;
  [m[i],m[pivot]]=[m[pivot],m[i]];const d=m[i][i];if(Math.abs(d)<1e-10)return null;
  for(let k=i;k<=n;k++)m[i][k]/=d;
  for(let j=0;j<n;j++){if(j===i)continue;const f=m[j][i];for(let k=i;k<=n;k++)m[j][k]-=f*m[i][k]}
 }
 return m.map(r=>r[n]);
}
/** Poisson count model: observed grid plus prior qualifying pace, never finishing place as a predictor. */
export function fitOvertakeModel(history:ComponentObservation[],options:{season:number;round:number;ridge?:number}):OvertakeModel{
 const ridge=options.ridge??8;
 if(!Number.isInteger(options.round)||options.round<1||!Number.isFinite(ridge)||ridge<=0)throw Error('Invalid overtake model options');
 const unique=new Map<string,ComponentObservation>();
 for(const o of history)if(o.type==='DRIVER'&&o.season===options.season&&Number.isInteger(o.round)&&o.round>0&&o.round<options.round)unique.set(o.code+':'+o.round,o);
 const rows=[...unique.values()].sort((a,b)=>a.round-b.round||a.code.localeCompare(b.code));
 const samples:{x:number[];y:number}[]=[];
 for(const o of rows){
  if(!o.race||o.race.failed||o.race.finishPosition==null)continue;
  // Archived awarded position-change points reconstruct the actual starting position.
  const start=o.race.finishPosition+o.race.positionChange;
  if(!Number.isInteger(start)||start<1||start>22||!Number.isFinite(o.race.overtakes)||o.race.overtakes<0)continue;
  samples.push({x:features(start,paceFor(rows.filter(p=>p.round<o.round),o.code)),y:o.race.overtakes});
 }
 let beta=[Math.log(samples.length?Math.max(.1,samples.reduce((n,r)=>n+r.y,0)/samples.length):4),0,0,0];
 if(samples.length>=20)for(let iteration=0;iteration<30;iteration++){
  const h=Array.from({length:4},()=>Array(4).fill(0)),gradient=Array(4).fill(0);
  for(const sample of samples){const mu=Math.exp(clamp(sample.x.reduce((n,v,i)=>n+v*beta[i],0),-4,4));for(let i=0;i<4;i++){gradient[i]+=sample.x[i]*(sample.y-mu);for(let j=0;j<4;j++)h[i][j]+=sample.x[i]*sample.x[j]*mu}}
  for(let i=1;i<4;i++){h[i][i]+=ridge;gradient[i]-=ridge*beta[i]}
  h[0][0]+=1e-8;const step=solve(h,gradient);if(!step)break;
  beta=beta.map((b,i)=>b+clamp(step[i],-.5,.5));if(Math.max(...step.map(Math.abs))<1e-7)break;
 }
 const failures=rows.filter(o=>o.race?.failed),globalFailedMean=(failures.reduce((n,o)=>n+o.race!.overtakes,0)+3*1.5)/(failures.length+3);
 const pace:Record<string,number>={},failedMean:Record<string,number>={};
 for(const code of [...new Set(rows.map(o=>o.code))]){pace[code]=paceFor(rows,code);const own=failures.filter(o=>o.code===code);failedMean[code]=(own.reduce((n,o)=>n+o.race!.overtakes,0)+5*globalFailedMean)/(own.length+5)}
 return {season:options.season,beforeRound:options.round,trainingSessions:samples.length,coefficients:beta,pace,failedMean,globalFailedMean};
}
export function expectedRaceOvertakes(model:OvertakeModel,code:string,start:number|null,classified:boolean){
 if(!classified)return clamp(model.failedMean[code]??model.globalFailedMean,0,25);
 const x=features(start!=null&&Number.isFinite(start)?start:11.5,model.pace[code]??0);
 return clamp(Math.exp(clamp(x.reduce((n,v,i)=>n+v*model.coefficients[i],0),-4,4)),0,25);
}
