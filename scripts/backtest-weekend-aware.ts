const FANTASY='https://fantasy.formula1.com/feeds/drivers';
const OPEN='https://api.openf1.org/v1';

type FantasyRow={PositionName?:string;DriverTLA?:string;GamedayPoints?:string|number|null;Value?:string|number|null};
type Session={meeting_key:number;session_key:number;session_name:string;session_type:string;date_start:string;date_end:string;circuit_short_name?:string};
type Driver={driver_number:number;name_acronym:string};
type Result={driver_number:number;position:number;duration:number|number[]|null;gap_to_leader:number|string|Array<number|string>|null;number_of_laps:number};

const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const std=(xs:number[])=>{if(xs.length<2)return 0;const m=mean(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1))};
const ewma=(h:number[],a=.25)=>{if(!h.length)return null;let x=h[0];for(const v of h.slice(1))x=a*v+(1-a)*x;return x};

async function get<T>(url:string):Promise<T>{
  for(let attempt=0;attempt<4;attempt++){
    const r=await fetch(url,{headers:{'user-agent':'Paddock-IQ backtest'}});
    if(r.ok)return r.json() as Promise<T>;
    if(r.status===429||r.status>=500){await new Promise(res=>setTimeout(res,750*(attempt+1)));continue;}
    throw Error(url+' -> '+r.status+' '+await r.text());
  }
  throw Error('Failed '+url);
}
async function tryJson<T>(url:string):Promise<T|null>{
  for(let attempt=0;attempt<6;attempt++){
    const r=await fetch(url,{headers:{'user-agent':'Paddock-IQ backtest'}});
    if(r.ok)return r.json() as Promise<T>;
    if(r.status===404)return null;
    if(r.status===429||r.status>=500){
      await new Promise(res=>setTimeout(res,1200*(attempt+1)));
      continue;
    }
    throw Error(url+' -> '+r.status+' '+await r.text());
  }
  return null;
}

async function tryResults(sessionKey:number):Promise<Result[]|null>{
  const url=OPEN+'/session_result?session_key='+sessionKey;
  for(let attempt=0;attempt<3;attempt++){
    const r=await fetch(url,{headers:{'user-agent':'Paddock-IQ backtest'}});
    if(r.ok)return r.json() as Promise<Result[]>;
    if(r.status===404)return null;
    if(r.status===429||r.status>=500){await new Promise(res=>setTimeout(res,600*(attempt+1)));continue;}
    throw Error(url+' -> '+r.status+' '+await r.text());
  }
  return null;
}

async function fantasy(round:number){
 const j=await get<any>(FANTASY+'/'+round+'_en.json?buster='+Date.now());
 return (Array.isArray(j?.Data?.Value)?j.Data.Value:[]) as FantasyRow[];
}
function solve(A:number[][],b:number[]){
 const n=b.length,M=A.map((r,i)=>[...r,b[i]]);
 for(let i=0;i<n;i++){
  let p=i;for(let j=i+1;j<n;j++)if(Math.abs(M[j][i])>Math.abs(M[p][i]))p=j;
  [M[i],M[p]]=[M[p],M[i]];
  const d=M[i][i];if(Math.abs(d)<1e-10)return null;
  for(let k=i;k<=n;k++)M[i][k]/=d;
  for(let j=0;j<n;j++){if(j===i)continue;const f=M[j][i];for(let k=i;k<=n;k++)M[j][k]-=f*M[i][k]}
 }
 return M.map(r=>r[n]);
}
function fitRidge(rows:{x:number[];y:number}[],lambda=50){
 if(!rows.length)return null;
 const d=rows[0].x.length,means=Array(d).fill(0),sds=Array(d).fill(1);
 for(let j=0;j<d;j++){const vals=rows.map(r=>r.x[j]);means[j]=mean(vals);const s=std(vals);sds[j]=s>1e-8?s:1}
 const X=rows.map(r=>[1,...r.x.map((v,j)=>(v-means[j])/sds[j])]),p=d+1;
 const A=Array.from({length:p},()=>Array(p).fill(0)),b=Array(p).fill(0);
 for(let i=0;i<X.length;i++)for(let a=0;a<p;a++){b[a]+=X[i][a]*rows[i].y;for(let c=0;c<p;c++)A[a][c]+=X[i][a]*X[i][c]}
 for(let j=1;j<p;j++)A[j][j]+=lambda;
 const beta=solve(A,b);if(!beta)return null;
 return {predict:(x:number[])=>beta[0]+x.reduce((s,v,j)=>s+beta[j+1]*(v-means[j])/sds[j],0)};
}
type Weekend={practicePos:number;practiceGapPct:number;practiceLaps:number;sqPos:number;sqGapPct:number;hasSq:number;hasPractice:number;isSprint:number};
type Ex={round:number;code:string;y:number;price:number;history:number[];weekend:Weekend};
type M={n:number;ae:number;sq:number;bias:number};
const init=():M=>({n:0,ae:0,sq:0,bias:0});
const add=(m:M,e:number)=>{m.n++;m.ae+=Math.abs(e);m.sq+=e*e;m.bias+=e};
const fmt=(m:M)=>({n:m.n,MAE:+(m.ae/m.n).toFixed(3),RMSE:+Math.sqrt(m.sq/m.n).toFixed(3),Bias:+(m.bias/m.n).toFixed(3)});

function baseFeatures(h:number[],price:number){return [ewma(h)??0,mean(h),price]}
function weekendFeatures(w:Weekend,kind:'practice'|'deadline'){
 const practice=[w.practicePos,w.practiceGapPct,w.practiceLaps];
 if(kind==='practice')return practice;
 return [...practice,w.sqPos,w.sqGapPct,w.hasSq,w.isSprint];
}
function practiceSubset(w:Weekend,kind:'pos'|'gap'|'pos_gap'|'pos_gap_laps'){
 if(kind==='pos')return [w.practicePos];
 if(kind==='gap')return [w.practiceGapPct];
 if(kind==='pos_gap')return [w.practicePos,w.practiceGapPct];
 return [w.practicePos,w.practiceGapPct,w.practiceLaps];
}

async function main(){
 const fantasyFeeds=new Map<number,FantasyRow[]>();
 for(let r=1;r<=15;r++)fantasyFeeds.set(r,await fantasy(r));

 const sessions=await get<Session[]>(OPEN+'/sessions?year=2026');
 const byMeeting=new Map<number,Session[]>();
 for(const s of sessions){const a=byMeeting.get(s.meeting_key)??[];a.push(s);byMeeting.set(s.meeting_key,a)}
 const meetings=[...byMeeting.entries()]
   .filter(([,ss])=>ss.some(s=>s.session_name==='Race'))
   .sort((a,b)=>+new Date(a[1].find(s=>s.session_name==='Race')!.date_start)-+new Date(b[1].find(s=>s.session_name==='Race')!.date_start))
   .slice(0,15);
 if(meetings.length<15)throw Error('Only '+meetings.length+' completed GP meetings found in OpenF1');

 const weekendByRound=new Map<number,Map<string,Weekend>>();

 for(let i=0;i<meetings.length;i++){
   const round=i+1,[meetingKey,ss]=meetings[i];
   const practice=ss.filter(s=>s.session_type==='Practice'||s.session_name.startsWith('Practice')).sort((a,b)=>+new Date(a.date_start)-+new Date(b.date_start));
   const isSprint=ss.some(s=>s.session_name.toLowerCase().includes('sprint')||s.session_type.toLowerCase().includes('sprint'));
   const sprintQ=ss.find(s=>{
     const n=s.session_name.toLowerCase(),t=s.session_type.toLowerCase();
     return (n.includes('sprint')||t.includes('sprint'))&&(n.includes('qualif')||n.includes('shootout')||t.includes('qualif'));
   });
   const race=ss.find(s=>s.session_name==='Race');
   if(!race)throw Error('No race session round '+round);

   let drivers=await tryJson<Driver[]>(OPEN+'/drivers?meeting_key='+meetingKey);
   if(!drivers?.length)drivers=await tryJson<Driver[]>(OPEN+'/drivers?session_key='+race.session_key);
   if(!drivers?.length){
     console.log('round',round,'meeting',meetingKey,'SKIP no driver mapping');
     continue;
   }
   const codeByNum=new Map(drivers.map(d=>[d.driver_number,String(d.name_acronym).toUpperCase()]));

   const out=new Map<string,Weekend>();
   for(const d of drivers){
     const code=String(d.name_acronym).toUpperCase();
     out.set(code,{practicePos:0,practiceGapPct:0,practiceLaps:0,sqPos:0,sqGapPct:0,hasSq:0,hasPractice:0,isSprint:isSprint?1:0});
   }

   // Use the latest available practice as the strongest pre-deadline practice snapshot.
   let lastPractice:Session|undefined;
   let practiceResults:Result[]|null=null;
   for(const s of [...practice].reverse()){
     const rs=await tryResults(s.session_key);
     if(rs?.length){lastPractice=s;practiceResults=rs;break;}
   }
   if(lastPractice&&practiceResults){
     const leader=Math.min(...practiceResults.map(r=>typeof r.duration==='number'?r.duration:Infinity));
     for(const r of practiceResults){
       const code=codeByNum.get(r.driver_number);if(!code)continue;
       const w=out.get(code)!;
       w.practicePos=Number.isFinite(r.position)?r.position:12;
       w.practiceGapPct=typeof r.duration==='number'&&Number.isFinite(leader)?100*(r.duration-leader)/leader:1.5;
       w.practiceLaps=Number.isFinite(r.number_of_laps)?r.number_of_laps:0;
       w.hasPractice=1;
     }
   }

   if(isSprint&&sprintQ){
     const rs=await tryResults(sprintQ.session_key);
     if(rs?.length){
       const bestDur=(r:Result)=>{
         if(Array.isArray(r.duration)){const nums=r.duration.filter((x):x is number=>typeof x==='number');return nums.length?nums.at(-1)!:Infinity}
         return typeof r.duration==='number'?r.duration:Infinity;
       };
       const leader=Math.min(...rs.map(bestDur));
       for(const r of rs){
         const code=codeByNum.get(r.driver_number);if(!code)continue;
         const w=out.get(code)!;const dur=bestDur(r);
         w.sqPos=Number.isFinite(r.position)?r.position:12;
         w.sqGapPct=Number.isFinite(dur)&&Number.isFinite(leader)?100*(dur-leader)/leader:1.5;
         w.hasSq=1;
       }
     }
   }
   weekendByRound.set(round,new Map([...out.entries()].filter(([,w])=>w.hasPractice===1)));
   console.log('round',round,'meeting',meetingKey,'practice',lastPractice?.session_name??'none','sprintQ',isSprint?sprintQ?.session_name??'missing':'n/a');
 }

 const histories=new Map<string,number[]>();
 const examples:Ex[]=[];
 for(let round=1;round<=15;round++){
   for(const row of fantasyFeeds.get(round)!.filter(r=>r.PositionName==='DRIVER')){
     const code=String(row.DriverTLA??'').toUpperCase(),y=Number(row.GamedayPoints),price=Number(row.Value);
     if(!code||!Number.isFinite(y)||!Number.isFinite(price))continue;
     const h=histories.get(code)??[];
     const w=weekendByRound.get(round)?.get(code);
     if(h.length>=2&&w)examples.push({round,code,y,price,history:[...h],weekend:w});
     h.push(y);histories.set(code,h);
   }
 }

 const variants=[
   {name:'baseline',kind:null as null|'practice'|'deadline',lambda:50},
   {name:'practice_l25',kind:'practice' as const,lambda:25},
   {name:'practice_l50',kind:'practice' as const,lambda:50},
   {name:'practice_l100',kind:'practice' as const,lambda:100},
   {name:'deadline_l25',kind:'deadline' as const,lambda:25},
   {name:'deadline_l50',kind:'deadline' as const,lambda:50},
   {name:'deadline_l100',kind:'deadline' as const,lambda:100},
 ];
 const metrics=new Map(variants.map(v=>[v.name,init()]));
 const sprintMetrics=new Map(variants.map(v=>[v.name,init()]));
 const normalMetrics=new Map(variants.map(v=>[v.name,init()]));

 for(let round=6;round<=15;round++){
   const trainBase=examples.filter(e=>e.round<round),test=examples.filter(e=>e.round===round);
   for(const v of variants){
     const fx=(e:Ex)=>v.kind?[...baseFeatures(e.history,e.price),...weekendFeatures(e.weekend,v.kind)]:baseFeatures(e.history,e.price);
     const model=fitRidge(trainBase.map(e=>({x:fx(e),y:e.y})),v.lambda);if(!model)continue;
     for(const e of test){
       const err=model.predict(fx(e))-e.y;
       add(metrics.get(v.name)!,err);
       add((e.weekend.isSprint?sprintMetrics:normalMetrics).get(v.name)!,err);
     }
   }
 }

 const gatedDefs=[
   {name:'gate_pos_l25',kind:'pos' as const,lambda:25},
   {name:'gate_gap_l25',kind:'gap' as const,lambda:25},
   {name:'gate_posgap_l25',kind:'pos_gap' as const,lambda:25},
   {name:'gate_full_l25',kind:'pos_gap_laps' as const,lambda:25},
   {name:'gate_posgap_l50',kind:'pos_gap' as const,lambda:50},
   {name:'gate_full_l50',kind:'pos_gap_laps' as const,lambda:50},
 ];
 const gatedMetrics=new Map(gatedDefs.map(v=>[v.name,init()]));

 for(let round=6;round<=15;round++){
   const trainBase=examples.filter(e=>e.round<round),test=examples.filter(e=>e.round===round);
   const baseModel=fitRidge(trainBase.map(e=>({x:baseFeatures(e.history,e.price),y:e.y})),50);
   if(!baseModel)continue;
   for(const def of gatedDefs){
     const practiceModel=fitRidge(trainBase.map(e=>({
       x:[...baseFeatures(e.history,e.price),...practiceSubset(e.weekend,def.kind)],
       y:e.y
     })),def.lambda);
     if(!practiceModel)continue;
     for(const e of test){
       const usePractice=!e.weekend.isSprint;
       const p=usePractice
         ? practiceModel.predict([...baseFeatures(e.history,e.price),...practiceSubset(e.weekend,def.kind)])
         : baseModel.predict(baseFeatures(e.history,e.price));
       add(gatedMetrics.get(def.name)!,p-e.y);
     }
   }
 }

 console.log('\nGATED: PRACTICE ON NORMAL / BASELINE ON SPRINT');
 console.table(gatedDefs.map(v=>({model:v.name,...fmt(gatedMetrics.get(v.name)!)})).sort((a,b)=>a.MAE-b.MAE));

 const table=(map:Map<string,M>)=>variants.map(v=>({model:v.name,...fmt(map.get(v.name)!)})).sort((a,b)=>a.MAE-b.MAE);
 console.log('\nWEEKEND-AWARE DRIVER WALK-FORWARD');console.table(table(metrics));
 console.log('\nNORMAL WEEKENDS');console.table(table(normalMetrics));
 console.log('\nSPRINT WEEKENDS');console.table(table(sprintMetrics));
}
main().catch(e=>{console.error(e);process.exitCode=1});
