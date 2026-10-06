export type MarketIdentity={code:string;name:string;type:'DRIVER'|'CONSTRUCTOR'};
export type ImportedF1Team={teamNo:number;name:string;cashBalance?:number;freeTransfers?:number;totalPoints?:number;assets:{code:string;type:'DRIVER'|'CONSTRUCTOR';isDoubled:boolean}[];chips:Record<string,'USED'|'AVAILABLE'>};
const constructors:Record<string,string>={'MCLAREN':'MCL','RED BULL':'RBR','RED BULL RACING':'RBR','FERRARI':'FER','MERCEDES':'MER','ASTON MARTIN':'AST','ALPINE':'ALP','HAAS':'HAS','HAAS F1 TEAM':'HAS','WILLIAMS':'WIL','RACING BULLS':'RB','RB':'RB','AUDI':'AUD','AUDI REVOLUT F1 TEAM':'AUD','CADILLAC':'CAD','CADILLAC FORMULA 1 TEAM':'CAD'};
const chipFields:Record<string,string>={LL:'islimitlesstaken',WC:'iswildcardtaken',FF:'isfinalfixtaken',AP:'isautopilottaken',NN:'isnonigativetaken',DRS:'isextradrstaken'};
function row(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid F1 export structure');return value as Record<string,unknown>}
function number(value:unknown,integer=false):number|undefined {if(value===undefined||value===null||value==='')return undefined;if(typeof value!=='number'&&typeof value!=='string')throw Error('Invalid numeric F1 field');const n=Number(value);if(!Number.isFinite(n)||(integer&&!Number.isInteger(n)))throw Error('Invalid numeric F1 field');return n}
function flag(value:unknown){if(value===true||value===1||value==='1')return true;if(value===false||value===0||value==='0')return false;return undefined}
export function normalizeF1TeamExport(payload:unknown,market:MarketIdentity[],season:number,round:number):{season:number;round:number;capturedAt:string;teams:ImportedF1Team[]}{
 const input=row(payload);
 if(input.format!=='paddock-iq-f1-v1')throw Error('Use the Paddock IQ browser helper to export your current F1 team.');
 if(Number(input.season)!==season||!Number.isInteger(season)||season<2026||season>2100||!Number.isInteger(round)||round<1||round>30||Number(input.round)!==round)throw Error('Export round does not match the selected round.');
 const capturedAt=String(input.capturedAt??'');const age=Date.now()-Date.parse(capturedAt);
 if(!Number.isFinite(age)||age< -60000||age>30*60*1000)throw Error('Export expired. Export your current team again (valid for 30 minutes).');
 if(!Array.isArray(input.players)||input.players.length>100||!Array.isArray(input.teams)||input.teams.length<1||input.teams.length>3)throw Error('Invalid F1 export teams or player catalog');
 const catalog=new Map<string,Record<string,unknown>>();for(const p of input.players){const item=row(p);const id=String(item.PlayerId??'');if(!id||catalog.has(id))throw Error('Duplicate or missing F1 player ID');catalog.set(id,item)}
 const teamNumbers=new Set<number>();
 const teams=input.teams.map(value=>{
  const t=row(value);const teamNo=number(t.teamno,true);if(!teamNo||teamNo<1||teamNo>3||teamNumbers.has(teamNo))throw Error('Invalid or duplicate F1 team number');teamNumbers.add(teamNo);
  let name=String(t.teamname??'');try{name=decodeURIComponent(name)}catch{throw Error('Invalid team name')};name=name.trim();if(!name||name.length>100)throw Error('Invalid team name');
  if(!Array.isArray(t.playerid)||t.playerid.length!==7)throw Error('Team must contain 5 drivers and 2 constructors. Final Fix / swap history is not supported; use manual setup.');
  const captain=String(t.capplayerid??'');
  const assets:ImportedF1Team["assets"]=t.playerid.map(value=>{
   const pick=row(value);const p=catalog.get(String(pick.id??''));if(!p)throw Error('Unmapped F1 player. Export again or use manual setup.');
   const type=p.PositionName;if(type!=='DRIVER'&&type!=='CONSTRUCTOR')throw Error('Unknown F1 asset type');
   const code=type==='DRIVER'?String(p.DriverTLA??'').trim().toUpperCase():constructors[String(p.TeamName??'').trim().toUpperCase()]??market.find(a=>a.type==='CONSTRUCTOR'&&a.name.toUpperCase()===String(p.TeamName??'').trim().toUpperCase())?.code;
   if(!code||!market.some(a=>a.type===type&&a.code===code))throw Error('F1 asset is missing from the selected season market. Use manual setup or sync the market.');
   return {code,type,isDoubled:String(pick.id)===captain};
  });
  if(assets.filter(a=>a.type==='DRIVER').length!==5||assets.filter(a=>a.type==='CONSTRUCTOR').length!==2||new Set(assets.map(a=>a.type+':'+a.code)).size!==7)throw Error('Invalid or duplicate F1 team assets');
  if(assets.filter(a=>a.type==='DRIVER'&&a.isDoubled).length!==1||assets.some(a=>a.type==='CONSTRUCTOR'&&a.isDoubled))throw Error('F1 team must have one selected 2× driver');
  const chips:ImportedF1Team['chips']={};for(const [code,field] of Object.entries(chipFields)){const used=flag(t[field]);if(used!==undefined)chips[code]=used?'USED':'AVAILABLE'}
  const cashBalance=number(t.team_info===undefined?undefined:row(t.team_info).teamBal);const remaining=number(t.usersubsleft,true);const freeTransfers=remaining===undefined?undefined:Math.max(0,remaining);const totalPoints=number(t.ovpoints,true);
  if(cashBalance!==undefined&&cashBalance<0)throw Error('Invalid F1 cash balance');
  return {teamNo,name,cashBalance,freeTransfers,totalPoints,assets,chips};
 });
 return {season,round,capturedAt,teams};
}
