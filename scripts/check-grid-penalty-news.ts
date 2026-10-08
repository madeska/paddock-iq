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
