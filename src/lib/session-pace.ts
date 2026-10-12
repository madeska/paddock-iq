import type {ComponentObservation} from './component-calibration';
export type SessionPace={season:number;beforeRound:number;sourceRounds:number[];qualifying:Record<string,number>;race:Record<string,number>;practiceApplied:boolean};
/** Research ranking signal; completed classification ranks only, never Fantasy totals or bonuses. */
export function fitSessionPace(history:readonly ComponentObservation[],options:{season:number;round:number;drivers:readonly string[];practice?:ReadonlyMap<string,number>}) :SessionPace{
 if(!Number.isInteger(options.round)||options.round<1||new Set(options.drivers).size!==options.drivers.length)throw Error('Invalid session pace scope');
 const unique=new Map<string,ComponentObservation>();
 for(const row of history)if(row.type==='DRIVER'&&row.season===options.season&&Number.isInteger(row.round)&&row.round>0&&row.round<options.round){const key=row.round+':'+row.code;if(unique.has(key))throw Error('Duplicate session pace identity');unique.set(key,row)}
 const rows=[...unique.values()],samples:{code:string;round:number;session:'qualifying'|'race';value:number}[]=[];
 for(const round of [...new Set(rows.map(r=>r.round))]){
  const field=rows.filter(r=>r.round===round),n=field.length;if(n<2||n>22)continue;
  // A visible rank outside the roster identifies an incomplete/invalid archived field.
  if(field.some(r=>r.qualifying?.position!=null&&r.qualifying.position>n))continue;
  const scale=Math.sqrt((n*n-1)/12);
  for(const session of ['qualifying','race'] as const){
   const classified=field.filter(r=>session==='qualifying'?r.qualifying&&!r.qualifying.noTime:r.race&&!r.race.failed);
   const positions=classified.map(r=>session==='qualifying'?r.qualifying!.position:r.race!.finishPosition);
   if(positions.some(p=>p==null||!Number.isInteger(p)||p<1||p>n)||new Set(positions).size!==positions.length)continue;
   classified.forEach((r,i)=>samples.push({code:r.code,round,session,value:((n+1)/2-positions[i]!)/scale}));
  }
 }
 function estimate(session:'qualifying'|'race'){
  const raw:Record<string,number>={},supported=new Set<string>();
  for(const code of options.drivers){const own=samples.filter(s=>s.code===code&&s.session===session);let weight=5,total=0;for(const s of own){const w=Math.pow(.5,(options.round-1-s.round)/4);weight+=w;total+=w*s.value}raw[code]=total/weight;if(own.length)supported.add(code)}
  return standardize(raw,[...supported]);
 }
 function standardize(raw:Record<string,number>,supported:readonly string[]){
  const values=supported.map(code=>raw[code]),mean=values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
  const sd=values.length?Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/values.length):0;
  return Object.fromEntries(options.drivers.map(code=>[code,supported.includes(code)&&sd>1e-8?(raw[code]-mean)/sd:0]));
 }
 let qualifying=estimate('qualifying'),race=estimate('race');
 const n=options.drivers.length,positions=options.drivers.map(code=>options.practice?.get(code));
 const practiceApplied=n>1&&positions.every(p=>p!=null&&Number.isInteger(p)&&p>=1&&p<=n)&&new Set(positions).size===n;
 if(practiceApplied){const scale=Math.sqrt((n*n-1)/12),mix=(raw:Record<string,number>)=>Object.fromEntries(options.drivers.map((code,i)=>[code,.75*raw[code]+.25*((n+1)/2-positions[i]!)/scale]));qualifying=mix(qualifying);race=mix(race)}
 return {season:options.season,beforeRound:options.round,sourceRounds:[...new Set(samples.map(s=>s.round))].sort((a,b)=>a-b),qualifying,race,practiceApplied};
}
