'use client';
import {useEffect,useRef,useState} from 'react';
import type {ImportedF1Team} from '../../lib/f1-team-import';
import {getRememberedProfile,rememberProfile} from '../../lib/remembered-profile';
export default function F1TeamImport(){
 const bookmark=useRef<HTMLAnchorElement>(null);
 const [rememberedEmail,setRememberedEmail]=useState('');const [editingProfile,setEditingProfile]=useState(false);
 const [helper,setHelper]=useState('');const [payload,setPayload]=useState<unknown>();const [teams,setTeams]=useState<ImportedF1Team[]>([]);
 const [teamNo,setTeamNo]=useState(1);const [email,setEmail]=useState('');const [season,setSeason]=useState(new Date().getFullYear());const [round,setRound]=useState(0);const [status,setStatus]=useState('');const [busy,setBusy]=useState(false);
 useEffect(()=>{const profile=getRememberedProfile();if(profile){setEmail(profile.email);setRememberedEmail(profile.email)}fetch('/api/team/f1/helper').then(async r=>{if(!r.ok)throw Error('Helper unavailable');const j=await r.json();setHelper(j.bookmarklet);bookmark.current?.setAttribute('href',j.bookmarklet)}).catch(()=>setStatus('Browser helper unavailable. You can use manual setup below.'))},[]);
 async function call(body:object){const r=await fetch('/api/team/f1/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw Error(j.error||'Import failed');return j}
 async function readFile(file?:File){setTeams([]);setPayload(undefined);setStatus('');if(!file)return;try{if(file.size>100000)throw Error('Export is too large');const data=JSON.parse(await file.text());setPayload(data);setSeason(Number(data.season)||0);setRound(Number(data.round)||0);setStatus('File loaded. Preview your current F1 team.')}catch(e){setStatus(e instanceof Error?e.message:'Invalid export')}}
 async function preview(){setBusy(true);setTeams([]);try{const j=await call({action:'preview',export:payload,season,round});setTeams(j.teams);setTeamNo(j.teams[0].teamNo);setStatus('Check your lineup and available status before saving.')}catch(e){setStatus(e instanceof Error?e.message:'Preview failed')}finally{setBusy(false)}}
 async function save(){setBusy(true);try{const j=await call({action:'save',export:payload,season,round,teamNo,email});rememberProfile({email,teamId:j.teamId,season});setRememberedEmail(email.trim().toLowerCase());setEditingProfile(false);setTeams([]);setPayload(undefined);setStatus(j.teams.length+' teams saved.')}catch(e){setStatus(e instanceof Error?e.message:'Import failed')}finally{setBusy(false)}}
 const selected=teams.find(t=>t.teamNo===teamNo);
 return <section><h2>Import from F1 Fantasy</h2><p>Sign in only on the official F1 site. Your F1 password and session stay there. This imports a snapshot; run it again after changing your F1 team.</p>
 <ol><li>Drag <a ref={bookmark} href="#" onClick={e=>{e.preventDefault();setStatus('Drag this link into your bookmarks bar. Run it from the F1 Fantasy My Team tab.')}}>Export F1 team</a> into your bookmarks bar. <button type="button" disabled={!helper} onClick={()=>navigator.clipboard.writeText(helper).then(()=>setStatus('Helper copied. Paste it into a bookmark URL.')).catch(()=>setStatus('Clipboard unavailable. Drag the helper link to your bookmarks bar.'))}>Copy bookmark URL</button></li>
 <li>Open <a href="https://fantasy.formula1.com/en/" target="_blank" rel="noopener noreferrer">F1 Fantasy</a>, sign in and open your current My Team. Run the bookmark to download your team file.</li>
 <li>Return here and select the downloaded file. It expires after 30 minutes.</li></ol>
 <label>F1 team export<input type="file" accept=".json,application/json" disabled={busy} onChange={e=>void readFile(e.target.files?.[0])}/></label>
 <div className="inputs"><label>Season<input type="number" min="2026" max="2100" value={season} readOnly/></label><label>Export round<input type="number" readOnly value={round||''}/></label></div>
 <p><button type="button" disabled={!payload||busy} onClick={preview}>Preview F1 team</button></p>
 {selected&&<div><p>All {teams.length} teams will be saved to this profile.</p><label>Preview team<select disabled={busy} value={teamNo} onChange={e=>setTeamNo(Number(e.target.value))}>{teams.map(t=><option key={t.teamNo} value={t.teamNo}>T{t.teamNo} · {t.name}</option>)}</select></label>
 <h3>{selected.name}</h3><p>Season {season} · Round {round}</p><ul>{selected.assets.map(a=><li key={a.type+a.code}>{a.code} · {a.type==='DRIVER'?'Driver':'Constructor'}{a.isDoubled?' · 2×':''}</li>)}</ul>
 <p>Cash: {selected.cashBalance===undefined?'Unknown':'$'+selected.cashBalance+'M'} · Free transfers: {selected.freeTransfers??'Unknown'} · Points: {selected.totalPoints??'Unknown'}</p>
 <p>Chips: {Object.entries(selected.chips).map(([code,status])=>code+': '+status).join(', ')||'Unknown'}. Unreported chip status stays unchanged.</p>
 <div>{rememberedEmail&&!editingProfile?<p>Saving to {rememberedEmail} <button type="button" disabled={busy} onClick={()=>setEditingProfile(true)}>Change profile</button></p>:<label>Paddock IQ profile email<input type="email" required disabled={busy} value={email} onChange={e=>setEmail(e.target.value)}/></label>}</div><p><button type="button" disabled={!email||busy} onClick={save}>Save all {teams.length} teams</button> <a href="/my-team">View My Team</a></p></div>}
 <p role="status" aria-live="polite">{busy?'Working…':status}</p></section>
}
