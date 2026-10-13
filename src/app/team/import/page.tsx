'use client';
import {useEffect,useState} from 'react';
import F1TeamImport from '../f1-team-import';
import {rememberProfile} from '../../../lib/remembered-profile';
import {readApiJson} from '../../../lib/api-response';

type MarketAsset={code:string;name:string;type:'DRIVER'|'CONSTRUCTOR';price:number|null};
type Pick={code:string;type:'DRIVER'|'CONSTRUCTOR';isDoubled?:boolean};

export default function TeamImportPage(){
 const [round,setRound]=useState(17);
 const [market,setMarket]=useState<MarketAsset[]>([]);
 const [email,setEmail]=useState(''); const [teamName,setTeamName]=useState('');
 const [cash,setCash]=useState(''); const [free,setFree]=useState('2'); const [points,setPoints]=useState('');
 const [drivers,setDrivers]=useState(['','','','','']); const [constructors,setConstructors]=useState(['','']);
 const [doubled,setDoubled]=useState(''); const [status,setStatus]=useState('Loading market…');
 const [saving,setSaving]=useState(false);

 useEffect(()=>{fetch('/api/account').then(readApiJson).then(j=>{if(j.user)setEmail(j.user.email)}).catch(()=>setStatus('Unable to load account.'));fetch('/api/market?season=2026').then(async r=>{const j=await readApiJson(r);if(!r.ok)throw Error(j.error||('Market unavailable ('+r.status+')'));const assets=Array.isArray(j.assets)?j.assets:[];setMarket(assets);setRound(j.round);setStatus(assets.length?'':'The market is not ready yet. Please try again later.');}).catch(e=>setStatus(e instanceof Error?e.message:'Market unavailable'))},[]);
 const driverMarket=market.filter(a=>a.type==='DRIVER'); const constructorMarket=market.filter(a=>a.type==='CONSTRUCTOR');
 function change(setter:(v:string[])=>void,arr:string[],i:number,v:string,isDriver=true){const n=[...arr];n[i]=v;setter(n);if(isDriver&&doubled&&!n.includes(doubled))setDoubled('')}
 async function submit(e:React.FormEvent){e.preventDefault();if(saving)return;
  const assets:Pick[]=[...drivers.map(code=>({code,type:'DRIVER' as const,isDoubled:code===doubled})),...constructors.map(code=>({code,type:'CONSTRUCTOR' as const}))];
  if(assets.some(a=>!a.code)){setStatus('Select all 5 drivers and 2 constructors.');return}
  setSaving(true);setStatus('Saving…');
  try{const r=await fetch('/api/team/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   team:{name:teamName,season:2026},round,
   cashBalance:cash===''?undefined:Number(cash),freeTransfers:free===''?undefined:Number(free),totalPoints:points===''?undefined:Number(points),assets
  })});const j=await readApiJson(r);if(!r.ok)throw Error(j.error||('Import failed ('+r.status+')'));rememberProfile({email,teamId:j.teamId,season:2026});setStatus('Team saved. Open My teams to view your lineup.')}
  catch(e){setStatus(e instanceof Error?e.message:'Import failed')}finally{setSaving(false)}
 }
 const select=(items:MarketAsset[],value:string,onChange:(v:string)=>void,label:string)=><select aria-label={label} required value={value} onChange={e=>onChange(e.target.value)}><option value="">Select…</option>{items.map(a=><option key={a.code} value={a.code}>{a.code} · {a.name}{a.price!=null?' · $'+a.price+'M':''}</option>)}</select>;
 return <main className="team-setup"><a href="/my-team">Back to My teams</a><header><h1>Add your teams</h1><p>Import an F1 Fantasy snapshot or build a lineup manually.</p></header>
 <F1TeamImport/><details><summary>Manual setup (fallback)</summary><section><form onSubmit={submit}><fieldset disabled={saving}><h2>Your team</h2><div className="inputs"><label>Team name<input required maxLength={100} value={teamName} onChange={e=>setTeamName(e.target.value)}/></label></div>
 <h2>Fantasy status</h2><div className="inputs"><label>Cash ($M)<input type="number" min="0" step=".1" value={cash} onChange={e=>setCash(e.target.value)}/></label><label>Free transfers<input type="number" min="0" step="1" value={free} onChange={e=>setFree(e.target.value)}/></label><label>Total points<input type="number" value={points} onChange={e=>setPoints(e.target.value)}/></label></div>
 <h2>5 drivers</h2>{drivers.map((v,i)=><label key={i}>Driver {i+1} {select(driverMarket,v,x=>change(setDrivers,drivers,i,x),`Driver ${i+1}`)}</label>)}
 <label>2× driver {select(driverMarket.filter(a=>drivers.includes(a.code)),doubled,setDoubled,'2× driver')}</label>
 <h2>2 constructors</h2>{constructors.map((v,i)=><label key={i}>Constructor {i+1} {select(constructorMarket,v,x=>change(setConstructors,constructors,i,x,false),`Constructor ${i+1}`)}</label>)}
 <p><button type="submit" aria-busy={saving}>{saving?'Saving…':'Save team'}</button></p></fieldset></form><p className="notice" role="status">{status||'Market loaded: '+market.length+' assets.'}</p><a href="/my-team">View My teams</a></section>
 </details><footer>This setup stores a Paddock IQ snapshot only. Only your signed-in account can access these teams.</footer></main>
}
