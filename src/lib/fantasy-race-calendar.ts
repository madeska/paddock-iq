/** One identity registry for imported, displayed and provider-matched Fantasy rounds. */
export const FANTASY_RACES_2026=[
 {round:16,name:'Bahrain GP in Malaysia',aliases:['Bahrain GP in Malaysia']},
 {round:17,name:'Singapore GP',aliases:['Singapore Grand Prix']},
 {round:18,name:'United States GP',aliases:['United States Grand Prix']},
 {round:19,name:'Mexico City GP',aliases:['Mexico GP','Mexico Grand Prix','Mexico City Grand Prix']},
 {round:20,name:'São Paulo GP',aliases:['Sao Paulo GP','São Paulo Grand Prix','Sao Paulo Grand Prix']},
 {round:21,name:'Las Vegas GP',aliases:['Las Vegas Grand Prix']},
 {round:22,name:'Qatar GP',aliases:['Qatar Grand Prix']},
 {round:23,name:'Abu Dhabi GP',aliases:['Abu Dhabi Grand Prix']}
] as const;
const clean=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+(?:grand prix|gp)\b.*$/,'').replace(/\s+/g,' ').trim();
const identities=new Map<string,string>();
for(const race of FANTASY_RACES_2026)for(const name of [race.name,...race.aliases]){
 const key=clean(name),canonical=clean(race.name);
 if(identities.has(key)&&identities.get(key)!==canonical)throw Error('Ambiguous Fantasy event identity');
 identities.set(key,canonical);
}
export const normalizeFantasyRaceName=(name:string)=>identities.get(clean(name))??clean(name);
export function fantasyRaceName(season:number,round:number){return season===2026?FANTASY_RACES_2026.find(race=>race.round===round)?.name??'Round '+round:'Round '+round}
