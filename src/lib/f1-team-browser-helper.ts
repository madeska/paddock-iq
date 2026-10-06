// Kept as standalone JavaScript: transpiler helpers must never leak into a bookmarklet.
const source = String.raw`async function exportF1TeamInBrowser(){
 try{
  if(location.origin!=='https://fantasy.formula1.com')throw Error('Open F1 Fantasy, sign in there, then open My Team before running this helper.');
  const urls=performance.getEntriesByType('resource').map(e=>e.name).reverse();
  const found=urls.find(value=>{try{const u=new URL(value);return u.origin===location.origin&&/^\/services\/user\/gameplay\/[^/]+\/getteam\/\d+\/\d+\/\d+\/\d+$/.test(u.pathname)}catch{return false}});
  if(!found)throw Error('Open My Team in this tab first, wait for your lineup to load, then run the helper again.');
  const url=new URL(found);url.search='';url.searchParams.set('buster',String(Date.now()));
  async function get(path){const response=await fetch(path,{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('F1 session expired or data unavailable. Sign in on F1 and open My Team again.');const json=await response.json();if(json.Meta?.Success===false)throw Error('F1 could not load your team. Open My Team and try again.');return json.Data?.Value??json}
  const schedule=await get(location.origin+'/feeds/schedule/raceday_en.json');
  if(!Array.isArray(schedule))throw Error('F1 schedule unavailable. Use manual setup.');
  /* Match the official client priority: live, processing, provisional, current, upcoming. */
  const current=[2,3,5,1,0].map(status=>schedule.find(f=>Number(f.MatchStatus)===status)).find(Boolean);
  if(!current)throw Error('No current F1 round available. Use manual setup.');
  const parts=url.pathname.split('/');parts[parts.length-2]=String(current.GamedayId);parts[parts.length-1]=String(current.PhaseId);url.pathname=parts.join('/');
  const season=Number(current.Season);
  const data=await get(url.href);const round=Number(data.mdid);
  if(round!==Number(current.GamedayId)||!Number.isInteger(season))throw Error('F1 returned a different round. Open My Team and try again.');
  if(!Number.isInteger(round)||round<1||round>30||!Array.isArray(data.userTeam)||!data.userTeam.length)throw Error('No current F1 team found. Use manual setup.');

  const rows=await get(location.origin+'/feeds/drivers/'+round+'_en.json');if(!Array.isArray(rows))throw Error('F1 player catalog unavailable. Use manual setup.');
  const fields=['teamno','teamname','capplayerid','usersubsleft','ovpoints','islimitlesstaken','iswildcardtaken','isfinalfixtaken','isautopilottaken','isnonigativetaken','isextradrstaken'];
  const teams=data.userTeam.map((t)=>{
   const clean={};for(const key of fields)if(t[key]!==undefined)clean[key]=t[key];
   clean.playerid=Array.isArray(t.playerid)?t.playerid.map((p)=>({id:p.id})):[];
   const info={};for(const key of ['teamBal','userSubsleft','subsallowed'])if(t.team_info?.[key]!==undefined)info[key]=t.team_info[key];if(Object.keys(info).length)clean.team_info=info;return clean;
  });
  const players=rows.map((p)=>({PlayerId:p.PlayerId,DriverTLA:p.DriverTLA,TeamName:p.TeamName,PositionName:p.PositionName}));
  const blob=new Blob([JSON.stringify({format:'paddock-iq-f1-v1',capturedAt:new Date().toISOString(),season,round,teams,players})],{type:'application/json'});
  const download=document.createElement('a');download.href=URL.createObjectURL(blob);download.download='paddock-iq-f1-team.json';download.click();setTimeout(()=>URL.revokeObjectURL(download.href),10000);
  alert('F1 team exported. Return to Paddock IQ and select this file to preview and save your team.');
 }catch(error){alert(error instanceof Error?error.message:'F1 export failed. Use manual setup.')}
}
`;
export function f1TeamBookmarklet(){return 'javascript:void ('+source+')()'}
