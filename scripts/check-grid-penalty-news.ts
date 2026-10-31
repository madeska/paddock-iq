import assert from 'node:assert/strict';
import {test} from 'node:test';
import {applyGridDrops,parseOfficialPenaltyArticle} from '../src/lib/grid-penalty-news';
const context={season:2026,round:17,eventName:'Singapore GP',deadline:new Date('2026-10-10T09:00:00Z'),asOf:new Date('2026-10-09T16:00:00Z'),drivers:[{code:'RUS',name:'George Russell'},{code:'VER',name:'Max Verstappen'}]};
const article={url:'https://www.formula1.com/en/latest/article/russell-penalty.abc',headline:'Russell handed five-place grid penalty for Singapore Grand Prix',description:'George Russell has been handed a five-place grid penalty for the Singapore Grand Prix.',publishedAt:'2026-10-09T10:00:00Z',modifiedAt:'2026-10-09T10:00:00Z'};
test('confirmed official numeric penalty retains event/session/source',()=>{const r=parseOfficialPenaltyArticle(article,context);assert.equal(r?.status,'CONFIRMED');assert.equal(r?.code,'RUS');assert.equal(r?.places,5);assert.equal(r?.session,'RACE');assert.equal(r?.sourceUrl,article.url)});
test('rumors and ambiguous reports cannot become confirmed penalties',()=>{const r=parseOfficialPenaltyArticle({...article,headline:'Russell could face five-place grid penalty for Singapore Grand Prix'},context);assert.equal(r?.status,'PENDING');assert.equal(r?.places,null)});
test('other event/year, late publication or edits and unofficial sources excluded',()=>{for(const a of [{...article,headline:article.headline.replace('Singapore','Belgian')},{...article,publishedAt:'2025-10-09T10:00:00Z'},{...article,modifiedAt:'2026-10-10T10:00:00Z'},{...article,url:'https://example.com/penalty'}])assert.equal(parseOfficialPenaltyArticle(a,context),null)});
test('numeric grid drop moves rivals forward without changing qualification',()=>{const quali=['A','B','C','D'];assert.deepEqual([...applyGridDrops(quali,{A:3})],[['B',1],['C',2],['D',3],['A',4]]);assert.deepEqual(quali,['A','B','C','D']);assert.deepEqual([...applyGridDrops(quali,{A:20,B:3})],[['C',1],['D',2],['B',3],['A',4]])});
test('invalid drops and driver identities fail closed',()=>{assert.throws(()=>applyGridDrops(['A','B'],{X:3}));assert.throws(()=>applyGridDrops(['A','B'],{A:-1}));assert.throws(()=>applyGridDrops(['A','A'],{}))});

import {getGridPenaltyNews} from '../src/lib/grid-penalty-news';
import {mock} from 'node:test';
test('official news scan fetches penalty articles and surfaces source failures',async()=>{
 const deadline=new Date(Date.now()+86400000),asOf=new Date();const c={...context,deadline,asOf,season:asOf.getUTCFullYear()};
 const a={...article,publishedAt:new Date(+asOf-60000).toISOString(),modifiedAt:new Date(+asOf-60000).toISOString()};
 const m=mock.method(globalThis,'fetch',async(input:any)=>new Response(String(input).endsWith('/en/latest')?'<a href="/en/latest/article/russell-penalty.abc">News</a>':'<script type="application/ld+json">'+JSON.stringify({'@type':'NewsArticle',headline:a.headline,description:a.description,datePublished:a.publishedAt,dateModified:a.modifiedAt})+'</script>'));
 try{const result=await getGridPenaltyNews(c);assert.equal(result.mentions[0]?.status,'CONFIRMED');assert.equal(result.scanned,1)}finally{m.mock.restore()}
});
test('reports about penalties after this event do not apply to this grid',()=>{const a={...article,headline:'Russell handed five-place grid penalty after Singapore Grand Prix'};assert.notEqual(parseOfficialPenaltyArticle(a,context)?.status,'CONFIRMED')});
test('late observation and overturned decision remain unapplied',()=>{assert.equal(parseOfficialPenaltyArticle(article,{...context,asOf:new Date('2026-10-11T00:00:00Z')}),null);assert.equal(parseOfficialPenaltyArticle({...article,headline:'Russell Singapore Grand Prix grid penalty overturned'},context)?.status,'PENDING')});

test('body supplies exact event-specific penalty without treating rules as decisions',()=>{const a={...article,headline:'Russell discusses Singapore grid penalty',description:'',body:'Russell has been handed a ten-place grid penalty for the Singapore Grand Prix.'};assert.equal(parseOfficialPenaltyArticle(a,context)?.places,10);assert.equal(parseOfficialPenaltyArticle({...a,body:'If a driver exceeds an allocation, a ten-place grid penalty is applied.'},context)?.status,'PENDING')});
test('minimum remains explicitly uncertain and targets race rather than sprint',()=>{const a={...article,headline:'Russell promises attack from back of Singapore grid amid engine penalty',description:'',body:'Russell will receive a minimum of 10 positions for the Singapore Grand Prix, not the Sprint.'};const r=parseOfficialPenaltyArticle(a,context);assert.equal(r?.places,null);assert.equal(r?.minimumPlaces,10);assert.equal(r?.session,'RACE');assert.equal(r?.kind,'MINIMUM')});
test('explicit back-of-grid decision is separate from a numeric drop',()=>{const r=parseOfficialPenaltyArticle({...article,headline:'Russell Singapore grid penalty',description:'',body:'Russell will start at the back of the grid for the Singapore Grand Prix.'},context);assert.equal(r?.kind,'BACK_OF_GRID');assert.equal(r?.status,'CONFIRMED');assert.equal(r?.session,'RACE')});

import {extractOfficialArticleBody} from '../src/lib/grid-penalty-news';
test('confirmed back-of-grid race start takes precedence over a numeric lower bound in the same report',()=>{
 const a={...article,headline:'Russell promises attack from back of Singapore grid amid engine penalty',description:'',body:'George Russell has promised an attack in the Singapore Grand Prix as he prepares to line up at the back of the grid thanks to an engine-related penalty. The subsequent penalty will be a minimum of 10 positions depending on the parts. Russell’s penalty will be applied for Sunday’s Singapore Grand Prix, rather than Saturday’s Sprint.'};
 const result=parseOfficialPenaltyArticle(a,context);assert.equal(result?.status,'CONFIRMED');assert.equal(result?.kind,'BACK_OF_GRID');assert.equal(result?.session,'RACE');assert.equal(result?.places,null);
});
test('equivalent confirmed back-of-grid sentences agree while a hypothetical remains pending',()=>{
 const a={...article,headline:'Russell Singapore grid penalty',description:'',body:'Russell will start at the back of the grid for the Singapore Grand Prix. Russell is set to start the Singapore Grand Prix from the rear of the field due to a power unit change.'};
 assert.equal(parseOfficialPenaltyArticle(a,context)?.status,'CONFIRMED');
 assert.equal(parseOfficialPenaltyArticle({...a,body:'Russell could start the Singapore Grand Prix from the rear of the field if further parts are changed.'},context)?.status,'PENDING');
});
test('matching official stories and a compatible lower bound do not cancel a confirmed back-of-grid start',async()=>{
 const asOf=new Date(),c={...context,season:asOf.getUTCFullYear(),asOf,deadline:new Date(+asOf+86400000)};
 const paths=['/en/latest/article/russell-grid-a','/en/latest/article/russell-grid-b','/en/latest/article/russell-grid-min'];
 const bodies=['Russell will start at the back of the grid for the Singapore Grand Prix.','Russell is set to start the Singapore Grand Prix from the rear of the field.','Russell will receive a minimum of 10 positions for the Singapore Grand Prix, not the Sprint.'];
 const mocked=mock.method(globalThis,'fetch',async(input:any)=>{
  const url=String(input);if(url.endsWith('/en/latest'))return new Response(paths.map(p=>'<a href="'+p+'">Report</a>').join(''));
  const index=paths.findIndex(p=>url.endsWith(p));return new Response('<script type="application/ld+json">'+JSON.stringify({'@type':'NewsArticle',headline:'Russell Singapore grid penalty',description:'',articleBody:bodies[index],datePublished:new Date(+asOf-60000).toISOString(),dateModified:new Date(+asOf-60000).toISOString()})+'</script>');
 });
 try{
  const result=await getGridPenaltyNews(c);assert.equal(result.mentions.filter(m=>m.status==='CONFIRMED').length,2);assert.ok(result.mentions.filter(m=>m.status==='CONFIRMED').every(m=>m.kind==='BACK_OF_GRID'&&m.session==='RACE'));
  bodies[2]='Russell has been handed a five-place grid penalty for the Singapore Grand Prix.';
  const conflicting=await getGridPenaltyNews(c);assert.equal(conflicting.mentions.filter(m=>m.status==='CONFIRMED').length,0);
 }finally{mocked.mock.restore()}
});
test('publisher rich text links minimum and race-only statement without reading navigation',()=>{
 const body=extractOfficialArticleBody('<nav>Russell five-place penalty</nav><div class="content-rich-text"><div><p>The subsequent penalty will be a minimum of 10 positions depending on the parts.</p><p>Russell’s penalty will be applied for Sunday’s Singapore Grand Prix, rather than Saturday’s Sprint.</p></div></div>');
 assert.ok(!body.includes('five-place'));const r=parseOfficialPenaltyArticle({...article,headline:'Russell attack from back of Singapore grid amid engine penalty',body},context);assert.equal(r?.minimumPlaces,10);assert.equal(r?.session,'RACE');assert.equal(r?.status,'PENDING');
});
test('current event archive finds a confirmed penalty after it leaves the latest headlines',async()=>{
 const asOf=new Date(),c={...context,season:asOf.getUTCFullYear(),asOf,deadline:new Date(+asOf+86400000)},requested:string[]=[];
 const path='/en/latest/article/russell-grid-archived';
 const mocked=mock.method(globalThis,'fetch',async(input:any)=>{
  const url=String(input);requested.push(url);
  if(url.includes('/en/racing/'))return new Response('<a href="/en/latest/tags/singapore.tag-id">Singapore news</a><a href="/en/latest/tags/beyond-the-grid.other">Other</a>');
  if(url.endsWith('/en/latest/tags/singapore.tag-id?articleFilters=Articles'))return new Response('<a href="/en/latest/tags/singapore.tag-id?articleFilters=Articles&amp;page=2">Next</a>');
  if(url.endsWith('/en/latest/tags/singapore.tag-id?page=2&articleFilters=Articles'))return new Response('<a href="'+path+'">Penalty</a>');
  if(url.endsWith(path))return new Response('<script type="application/ld+json">'+JSON.stringify({'@type':'NewsArticle',headline:'Russell Singapore grid penalty',description:'',articleBody:'Russell will start at the back of the grid for the Singapore Grand Prix.',datePublished:new Date(+asOf-60000).toISOString(),dateModified:new Date(+asOf-60000).toISOString()})+'</script>');
  return new Response('<p>Latest unrelated news</p>');
 });
 try{const result=await getGridPenaltyNews(c);assert.equal(result.mentions[0]?.status,'CONFIRMED');assert.equal(result.mentions[0]?.kind,'BACK_OF_GRID');assert.ok(!requested.some(u=>u.includes('beyond-the-grid.other')))}finally{mocked.mock.restore()}
});
import {parseOfficialPenaltyArticles} from '../src/lib/grid-penalty-news';
const mexicoContext={...context,round:19,eventName:'Mexico City GP',isSprint:false,deadline:new Date('2026-10-31T21:00:00Z'),asOf:new Date('2026-10-31T10:00:00Z'),drivers:[{code:'VER',name:'Max Verstappen'},{code:'LAW',name:'Liam Lawson'}]};
const mexicoArticle={...article,url:'https://www.formula1.com/en/latest/article/verstappen-and-lawson-grid-penalties.abc',headline:'Verstappen and Lawson get grid penalties after clumsy Mexico City practice clash',description:'Max Verstappen and Liam Lawson will both lose a place on the grid at the Autodromo Hermanos Rodriguez.',body:'The stewards issued individual one-place grid drops after reviewing the practice collision. Each driver also received one penalty point.',publishedAt:'2026-10-31T04:58:00Z',modifiedAt:'2026-10-31T04:58:00Z'};
test('Mexico joint decision produces separate one-place race drops for both drivers',()=>{
 const mentions=parseOfficialPenaltyArticles(mexicoArticle,mexicoContext);
 assert.deepEqual(mentions.map(m=>[m.code,m.status,m.places,m.session]),[['VER','CONFIRMED',1,'RACE'],['LAW','CONFIRMED',1,'RACE']]);
 assert.deepEqual([...applyGridDrops(['VER','X','LAW','Y'],Object.fromEntries(mentions.map(m=>[m.code!,m.places!])) )],[['X',1],['VER',2],['Y',3],['LAW',4]]);
});
test('joint report cannot assign a race penalty without a verified normal weekend or explicit session',()=>{
 for(const isSprint of [undefined,true])assert.ok(parseOfficialPenaltyArticles(mexicoArticle,{...mexicoContext,isSprint}).every(m=>m.status!=='CONFIRMED'));
});
test('joint rumors, penalty points alone, mismatched recipients and conflicting drops stay pending',()=>{
 for(const change of [
  {description:mexicoArticle.description.replace('will both','could both')},
  {description:'Both drivers received a penalty point.',body:'The stewards issued one penalty point each.'},
  {description:'Max Verstappen will lose one place on the grid.'},
  {body:'The stewards issued individual five-place grid drops.'},
  {body:'The penalty was overturned.'},
 ])assert.ok(parseOfficialPenaltyArticles({...mexicoArticle,...change},mexicoContext).every(m=>m.status!=='CONFIRMED'));
});
test('scanner retains both recipients from the same source URL',async()=>{
 const asOf=new Date(),c={...mexicoContext,season:asOf.getUTCFullYear(),asOf,deadline:new Date(+asOf+86400000)};
 const mocked=mock.method(globalThis,'fetch',async(input:any)=>new Response(String(input).endsWith('/en/latest')?'<a href="/en/latest/article/verstappen-lawson-grid.abc">News</a>':'<script type="application/ld+json">'+JSON.stringify({'@type':'NewsArticle',headline:mexicoArticle.headline,description:mexicoArticle.description,articleBody:mexicoArticle.body,datePublished:new Date(+asOf-60000).toISOString(),dateModified:new Date(+asOf-60000).toISOString()})+'</script>'));
 try{const r=await getGridPenaltyNews(c);assert.deepEqual(r.mentions.map(m=>[m.code,m.places,m.status]),[['VER',1,'CONFIRMED'],['LAW',1,'CONFIRMED']])}finally{mocked.mock.restore()}
});
test('publisher description may omit the amount: named body decision supplies individual drops',()=>{
 const a={...mexicoArticle,description:'Following the Mexico practice incident, the stewards penalised Max Verstappen and Liam Lawson.',body:'After speaking to Verstappen and Lawson, the stewards issued individual one-place grid drops. They also assigned a penalty point each.'};
 assert.deepEqual(parseOfficialPenaltyArticles(a,mexicoContext).map(m=>[m.code,m.places,m.status]),[['VER',1,'CONFIRMED'],['LAW',1,'CONFIRMED']]);
});
test('joint future conditions and another event cannot become current-event decisions',()=>{
 for(const description of ['If Verstappen and Lawson cause another collision, they will both lose a place on the grid at the Mexico City Grand Prix.','Verstappen and Lawson will both lose a place on the grid at the Sao Paulo Grand Prix.']){
  assert.ok(parseOfficialPenaltyArticles({...mexicoArticle,description,body:''},mexicoContext).every(m=>m.status!=='CONFIRMED'));
 }
});
