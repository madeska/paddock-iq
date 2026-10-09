export type PenaltyArticle={body?:string;url:string;headline:string;description:string;publishedAt:string;modifiedAt:string};
export type PenaltyNewsContext={season:number;round:number;eventName:string;deadline:Date;asOf:Date;drivers:readonly {code:string;name:string}[]};
export type PenaltyMention={kind?:'EXACT'|'MINIMUM'|'BACK_OF_GRID';minimumPlaces?:number;code:string|null;places:number|null;session:'RACE'|'SPRINT'|null;status:'CONFIRMED'|'PENDING';sourceUrl:string;publishedAt:string;headline:string;reason:string};
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function official(url:string){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='www.formula1.com'&&u.pathname.startsWith('/en/latest/article/')&&!u.username&&!u.password}catch{return false}}
/** Conservative headline extraction: unsupported or uncertain cases remain visible, never applied. */
export function parseOfficialPenaltyArticle(article:PenaltyArticle,c:PenaltyNewsContext):PenaltyMention|null{
 if(!official(article.url))return null;
 const pub=Date.parse(article.publishedAt),modified=Date.parse(article.modifiedAt),cutoff=Math.min(+c.deadline,+c.asOf);
 if(!Number.isFinite(cutoff)||!Number.isFinite(pub)||!Number.isFinite(modified)||modified<pub||pub>=cutoff||modified>=cutoff||+c.asOf>=+c.deadline||new Date(pub).getUTCFullYear()!==c.season||pub<cutoff-14*86400000)return null;
 const title=normalize(article.headline),event=normalize(c.eventName).replace(/\s+(grand prix|gp)\b.*$/,'').trim();
 if(!event||!title.includes(event)||!/penalt|back of (?:the )?grid|pit.lane start/.test(title))return null;
 const names=c.drivers.filter(d=>{const surname=normalize(d.name).split(/\s+/).at(-1)!;return surname.length>2&&new RegExp('\\b'+surname.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b').test(title)});
 const code=names.length===1?names[0].code:null;

 // Body evidence must name this driver and event in the same sentence. Rules and hypotheticals are excluded.
 if(article.body&&code&&!/\bcould\b|\bmay\b|\bmight\b|\bappeal\b|\boverturned\b|\breversed\b|\bno penalty\b/.test(title+' '+normalize(article.description))){
  const surname=normalize(c.drivers.find(d=>d.code===code)!.name).split(/\s+/).at(-1)!;
  const body=normalize(article.body);
  const lowerBounds=[...body.matchAll(/(?:penalty will be a minimum of|penalty of at least) (\d+) (?:grid )?(?:positions|places)/g)];
  const raceOnly=body.split(/[.!?\n]+/).some(t=>t.includes(surname)&&t.includes(event)&&/penalty will be applied/.test(t)&&/grand prix/.test(t)&&/rather than.*sprint/.test(t));
  const sentences=normalize(article.body).split(/[.!?\n]+/).filter(t=>t.includes(surname)&&t.includes(event)&&!/\bif\b|\bcould\b|\bmay\b|\bmight\b|\bappeal\b|\boverturned\b|\breversed\b|\bno penalty\b/.test(t));
  const evidence:PenaltyMention[]=[];
  for(const sentence of sentences){
   const race=/\bgrand prix\b|\brace\b/.test(sentence),sprint=/\bsprint\b/.test(sentence)&&!/\b(?:not|rather than) (?:the )?(?:saturday.s )?sprint\b/.test(sentence);
   const target=race&&!sprint?'RACE':sprint&&!race?'SPRINT':null;if(!target)continue;
   const base={code,places:null,session:target,status:'PENDING',sourceUrl:article.url,publishedAt:article.publishedAt,headline:article.headline} as PenaltyMention;
   const minimum=sentence.match(/(?:minimum of|at least) (\d+) (?:grid )?(?:positions|places)/);
   if(minimum&&+minimum[1]>0&&+minimum[1]<=100){evidence.push({...base,kind:'MINIMUM',minimumPlaces:+minimum[1],reason:'At least '+minimum[1]+' grid places for '+target+'; final penalty unknown, not applied'});continue}
   if(/\b(?:will|is set to|is due to|prepares to|is preparing to) (?:start|line up)\b[^.!?]{0,100}\b(?:at|from) the (?:back of the grid|rear of the field)\b/.test(sentence)){evidence.push({...base,kind:'BACK_OF_GRID',status:'CONFIRMED',reason:'Confirmed back-of-grid start for '+target});continue}
   const exact=parseOfficialPenaltyArticle({...article,body:undefined,headline:sentence,description:''},c);
   if(exact?.status==='CONFIRMED'&&!/minimum|at least|depending/.test(sentence))evidence.push({...exact,headline:article.headline,kind:'EXACT'});
  }
  const unique=evidence.filter((m,i)=>evidence.findIndex(other=>other.kind===m.kind&&other.session===m.session&&other.places===m.places&&other.minimumPlaces===m.minimumPlaces)===i);
  // A confirmed starting group is enough even when the exact cumulative drop remains unknown.
  const back=unique.find(m=>m.kind==='BACK_OF_GRID');
  if(back&&unique.every(m=>m.session===back.session&&(m.kind==='BACK_OF_GRID'||m.kind==='MINIMUM')))return back;
  if(unique.length===1)return unique[0];
  if(unique.length>1)return {code,places:null,session:null,status:'PENDING',sourceUrl:article.url,publishedAt:article.publishedAt,headline:article.headline,reason:'Multiple penalty statements require reconciliation; not applied'};
  if(lowerBounds.length===1&&raceOnly&&+lowerBounds[0][1]>0&&+lowerBounds[0][1]<=100)return {code,places:null,minimumPlaces:+lowerBounds[0][1],kind:'MINIMUM',session:'RACE',status:'PENDING',sourceUrl:article.url,publishedAt:article.publishedAt,headline:article.headline,reason:'At least '+lowerBounds[0][1]+' grid places for RACE only; final penalty unknown, not applied'};
 }
 const number=title.match(/\b(\d+|three|five|ten|fifteen|twenty)[ -]place(?:s)?\b/);
 const words:Record<string,number>={three:3,five:5,ten:10,fifteen:15,twenty:20};
 const places=number?(words[number[1]]??Number(number[1])):null;
 const session=/\bsprint\b/.test(title)?'SPRINT':/\bgrand prix\b|\bgp\b|\brace\b/.test(title)?'RACE':null;
 const uncertain=/\bcould\b|\bmay\b|\bmight\b|\bpossible\b|\bpotential\b|\bavoids?\b|\bescapes?\b|\bappeal\b|\boverturned\b|\breversed\b|\bno penalty\b/.test(title+' '+normalize(article.description));
 const eventPattern=event.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const appliesHere=new RegExp('(?:for|at|ahead of) (?:the )?'+eventPattern+' (?:grand prix|gp|sprint)').test(title);
 const confirmed=appliesHere&&/grid/.test(title)&&code&&places!=null&&Number.isInteger(places)&&places>0&&places<=100&&session&&!uncertain&&/\bhanded\b|\bgiven\b|\breceives?\b|\bgets\b|\bto serve\b|\bhit with\b/.test(title);
 return {code,places:confirmed?places:null,session,status:confirmed?'CONFIRMED':'PENDING',sourceUrl:article.url,publishedAt:article.publishedAt,headline:article.headline,reason:confirmed?'Explicit official headline; provisional grid, subject to later decisions':'Uncertain, unsupported or incomplete penalty details; not applied'};
}
/** Provisional classified grid: temporary positions, unpenalised slots, compression, >15 back group. */
export function applyGridDrops(order:readonly string[],drops:Readonly<Record<string,number>>):Map<string,number>{
 if(new Set(order).size!==order.length)throw Error('Duplicate grid driver');
 for(const [code,n] of Object.entries(drops))if(!order.includes(code)||!Number.isInteger(n)||n<0||n>100)throw Error('Invalid grid penalty');
 if(!Object.values(drops).some(n=>n>0))return new Map(order.map((code,i)=>[code,i+1]));
 const small=order.map((code,i)=>({code,q:i+1,n:drops[code]??0})).filter(d=>d.n>0&&d.n<=15).sort((a,b)=>(b.q+b.n)-(a.q+a.n)||b.q-a.q);
 const temporary=new Map<string,number>(),occupied=new Set<number>();
 for(const d of small){let p=d.q+d.n;while(occupied.has(p))p--;occupied.add(p);temporary.set(d.code,p)}
 const assigned=new Map<string,number>();let next=1;
 for(const code of order.filter(code=>!(drops[code]>0))){while(occupied.has(next))next++;assigned.set(code,next++)}
 const remaining=Array.from({length:order.length},(_,i)=>i+1).filter(p=>![...assigned.values()].includes(p));
 const penalized=[...small].sort((a,b)=>temporary.get(a.code)!-temporary.get(b.code)!||a.q-b.q).map(d=>d.code);
 const back=order.filter(code=>(drops[code]??0)>15);
 [...penalized,...back].forEach((code,i)=>assigned.set(code,remaining[i]));
 return new Map([...assigned].sort((a,b)=>a[1]-b[1]));
}
export async function getGridPenaltyNews(context:PenaltyNewsContext){
 const mentions:PenaltyMention[]=[],errors:string[]=[];
 if(+context.asOf>=+context.deadline)return {mentions,errors:['Live news not used for a locked weekend'],scanned:0};
 const get=async(url:string)=>{const r=await fetch(url,{headers:{'user-agent':'Paddock-IQ'},signal:AbortSignal.timeout(8000),redirect:'error'});if(!r.ok)throw Error('Official news HTTP '+r.status);return r.text()};
 let links:string[]=[];
 const articleLinks=(html:string)=>[...new Set(html.match(/\/en\/latest\/article\/[^"<>\\\s]+/g)??[])].slice(0,36).map(p=>'https://www.formula1.com'+p);
 try{links=articleLinks(await get('https://www.formula1.com/en/latest'))}catch{errors.push('Official F1 news unavailable')}
 // Discover the official event tag from its race page; a penalty can leave the front page before lock.
 const eventSlug=normalize(context.eventName).replace(/\s+(?:grand prix|gp)\b.*$/,'').trim().replace(/[^a-z0-9]+/g,'-');
 if(eventSlug&&Number.isInteger(context.season))try{
  const raceHtml=await get('https://www.formula1.com/en/racing/'+context.season+'/'+eventSlug);
  const tags=[...new Set(raceHtml.match(/\/en\/latest\/tags\/[a-z0-9-]+\.[a-zA-Z0-9-]+/g)??[])].filter(path=>path.startsWith('/en/latest/tags/'+eventSlug+'.'));
  if(tags.length===1){
   const tagHtml=await get('https://www.formula1.com'+tags[0]+'?articleFilters=Articles');
   const eventLinks=articleLinks(tagHtml);
   const pages=[...new Set((tagHtml.match(/\/en\/latest\/tags\/[^"<>\\\s]+/g)??[]).flatMap(path=>{
    const url=new URL(path.replaceAll('&amp;','&'),'https://www.formula1.com');
    const page=Number(url.searchParams.get('page'));return url.pathname===tags[0]&&Number.isInteger(page)&&page>1&&page<=3?[page]:[];
   }))].slice(0,2);
   for(const page of pages)try{eventLinks.push(...articleLinks(await get('https://www.formula1.com'+tags[0]+'?page='+page+'&articleFilters=Articles')))}catch{errors.push('Official event news page unavailable')}
   links=[...new Set([...eventLinks,...links])];
  }
 }catch{errors.push('Official event news unavailable')}
 // Sequential requests avoid a burst against the publisher. Only penalty-related URL slugs need parsing.
 let scanned=0;
 for(const url of links.filter(u=>/penalt|grid|pit-lane/i.test(u)).slice(0,6)){
  try{const html=await get(url);scanned++;
   for(const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    let parsed:any;try{parsed=JSON.parse(match[1])}catch{continue}
    const nodes=Array.isArray(parsed)?parsed:[parsed,...(parsed['@graph']??[])];
    for(const n of nodes){if(n['@type']!=='NewsArticle'||typeof n.headline!=='string'||typeof n.datePublished!=='string'||typeof n.dateModified!=='string')continue;
     const mention=parseOfficialPenaltyArticle({url,headline:n.headline,description:String(n.description??''),body:typeof n.articleBody==='string'?n.articleBody:extractOfficialArticleBody(html),publishedAt:n.datePublished,modifiedAt:n.dateModified},context);if(mention&&!mentions.some(m=>m.sourceUrl===url))mentions.push(mention);
    }
   }
  }catch{errors.push('Could not read official article: '+url)}
 }
 // Matching reports are not additive; compatible lower bounds do not overturn a confirmed back group.
 const conflicts=mentions.filter(m=>m.status==='CONFIRMED'&&mentions.some(other=>{
  if(other===m||other.code!==m.code||(other.session!==m.session&&other.session!==null))return false;
  if(other.status==='CONFIRMED'&&other.session===m.session&&other.kind===m.kind&&other.places===m.places)return false;
  if(m.kind==='BACK_OF_GRID'&&other.kind==='MINIMUM'&&other.session===m.session)return false;
  return true;
 }));
 for(const m of conflicts){m.status='PENDING';m.places=null;m.reason='Multiple reports for the same driver/session need reconciliation'}
 if(Date.now()>=+context.deadline){for(const m of mentions){m.status='PENDING';m.places=null;m.reason='News retrieval completed after lock; not applied'}errors.push('News retrieval crossed team lock')}
 return {mentions,errors,scanned};
}

/** Read only publisher rich-text blocks, excluding navigation, scripts and related headlines. */
export function extractOfficialArticleBody(html:string):string{
 return [...html.matchAll(/<div[^>]*class=["'][^"']*\bcontent-rich-text\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)].map(m=>m[1].replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"')).join('\n');
}
