export type FantasyStatisticsRace={round:number|string;raceName?:string;totalPoints:number};
export type FantasyStatisticsAsset={abbreviation?:string;code?:string;races?:FantasyStatisticsRace[]};

export function normalizeFantasyStatistics(payload:unknown){
 const assets:Array<{code:string;races:FantasyStatisticsRace[]}>=[];

 const visit=(value:unknown)=>{
  if(Array.isArray(value)){for(const item of value)visit(item);return}
  if(!value||typeof value!=='object')return;
  const row=value as Record<string,unknown>;
  const code=String(row.abbreviation??row.code??'').toUpperCase();
  const races=Array.isArray(row.races)?row.races as FantasyStatisticsRace[]:[];
  if(code&&races.length)assets.push({code,races});
  else for(const child of Object.values(row))visit(child);
 };
 visit(payload);

 const byRound=new Map<number,Record<string,number>>();
 for(const asset of assets)for(const race of asset.races){
  const round=Number(race.round),points=Number(race.totalPoints);
  if(!round||!Number.isFinite(points))continue;
  const scores=byRound.get(round)??{};
  scores[asset.code]=points;byRound.set(round,scores);
 }
 return [...byRound.entries()].sort((a,b)=>a[0]-b[0]).map(([round,scores])=>({round,scores}));
}
