'use client';
import {useEffect,useState} from 'react';

type MarketAsset={code:string;name:string;type:'DRIVER'|'CONSTRUCTOR';price:number|null};
type Pick={code:string;type:'DRIVER'|'CONSTRUCTOR';isDoubled?:boolean};

export default function TeamImportPage(){
 const [market,setMarket]=useState<MarketAsset[]>([]);
 const [email,setEmail]=useState(''); const [name,setName]=useState(''); const [teamName,setTeamName]=useState('');
 const [cash,setCash]=useState(''); const [free,setFree]=useState('2'); const [points,setPoints]=useState('');
 const [drivers,setDrivers]=useState(['','','','','']); const [constructors,setConstructors]=useState(['','']);
 const [doubled,setDoubled]=useState(''); const [status,setStatus]=useState('Loading market…');

 useEffect(()=>{fetch('/api/market?season=2026&round=18').then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||'Market unavailable');setMarket(j.assets);setStatus('');}).catch(e=>setStatus(e.message))},[]);
 const driverMarket=market.filter(a=>a.type==='DRIVER'); const constructorMarket=market.filter(a=>a.type==='CONSTRUCTOR');
 function change(setter:(v:string[])=>void,arr:string[],i:number,v:string){const n=[...arr];n[i]=v;setter(n);if(i<5&&doubled&&!n.includes(doubled))setDoubled('')}
 async function submit(e:React.FormEvent){e.preventDefault();setStatus('Saving…');
  const assets:Pick[]=[...drivers.map(code=>({code,type:'DRIVER' as const,isDoubled:code===doubled})),...constructors.map(code=>({code,type:'CONSTRUCTOR' as const}))];
  if(assets.some(a=>!a.code)){setStatus('Select all 5 drivers and 2 constructors.');return}
  try{const r=await fetch('/api/team/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   user:{email,name:name||undefined},team:{name:teamName,season:2026},round:18,grandPrixName:'Malaysia',
   cashBalance:cash===''?undefined:Number(cash),freeTransfers:free===''?undefined:Number(free),totalPoints:points===''?undefined:Number(points),assets
  })});const j=await r.json();if(!r.ok)throw Error(j.error||'Import failed');setStatus('Team saved. Snapshot '+j.snapshotId)}
  catch(e){setStatus(e instanceof Error?e.message:'Import failed')}
 }
 const select=(items:MarketAsset[],value:string,onChange:(v:string)=>void)=><select required value={value} onChange={e=>onChange(e.target.value)}><option value="">Select…</option>{items.map(a=><option key={a.code} value={a.code}>{a.code} · {a.name}{a.price!=null?' · $'+a.price+'M':''}</option>)}</select>;
 return <main><header><span className="eyebrow">PADDOCK IQ · TEAM SETUP</span><h1>Create / Import My Team</h1><p>Create your own Paddock IQ team using the shared market. No F1 password or session token is required.</p></header>
 <section><form onSubmit={submit}><h2>Profile</h2><div className="inputs"><label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Team name<input required value={teamName} onChange={e=>setTeamName(e.target.value)}/></label></div>
 <h2>Fantasy status</h2><div className="inputs"><label>Cash ($M)<input type="number" min="0" step=".1" value={cash} onChange={e=>setCash(e.target.value)}/></label><label>Free transfers<input type="number" min="0" value={free} onChange={e=>setFree(e.target.value)}/></label><label>Total points<input type="number" min="0" value={points} onChange={e=>setPoints(e.target.value)}/></label></div>
 <h2>5 drivers</h2>{drivers.map((v,i)=><label key={i}>Driver {i+1} {select(driverMarket,v,x=>change(setDrivers,drivers,i,x))}</label>)}
 <label>2× driver {select(driverMarket.filter(a=>drivers.includes(a.code)),doubled,setDoubled)}</label>
 <h2>2 constructors</h2>{constructors.map((v,i)=><label key={i}>Constructor {i+1} {select(constructorMarket,v,x=>change(setConstructors,constructors,i,x))}</label>)}
 <p><button type="submit">Save team</button></p></form><p className="notice">{status||'Market loaded: '+market.length+' assets.'}</p></section>
 <footer>This setup stores a Paddock IQ snapshot only. Production authentication/authorization will be added before public deployment.</footer></main>
}
