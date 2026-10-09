import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import primary from '../docs/official-statistics-2026-observation.json';
import history from '../src/data/component-history-2026.json';
import {officialHistoricalFantasyPrice} from '../src/lib/official-historical-price';
const canon=(code:string)=>({AMR:'AST',HAA:'HAS',RBS:'RB',VRB:'RB',RED:'RBR'} as Record<string,string>)[code]??code;
async function main(){
 const raw=await readFile('../simulation-research/f1fantasytools-statistics-2026-prospective-audit.json');assert.equal(createHash('sha256').update(raw).digest('hex'),'c558b1f27cc9c24f6d7865a501d148ddf5faf3fb1143c4cf7b26bafeaaabfc7d');const archive=JSON.parse(raw.toString());assert.equal(archive.seasonResult.season,2026);
 const feeds=new Map<number,any[]>(),sources=[];let links=0,quoteMatches=0,oldFieldMatches=0;
 for(let round=1;round<=16;round++){
  const bytes=await readFile('../simulation-research/round-'+round+'.json'),feed=JSON.parse(bytes.toString());assert.equal(feed.Meta.Success,true);sources.push({round,sha256:createHash('sha256').update(bytes).digest('hex'),serverTimestamp:feed.Meta.Timestamp.UTCTime});feeds.set(round,feed.Data.Value);
  const seen=new Set<string>();
  for(const row of feed.Data.Value.filter((r:any)=>String(r.IsActive)==='1')){
   const code=canon(row.DriverTLA),key=row.PositionName+':'+code;assert.ok(!seen.has(key));seen.add(key);
   const price=officialHistoricalFantasyPrice(row),previous=feeds.get(round-1)?.find(r=>String(r.PlayerId)===String(row.PlayerId)&&String(r.IsActive)==='1');if(previous){assert.equal(row.OldPlayerValue,previous.Value);links++}
   const target=(row.PositionName==='DRIVER'?archive.seasonResult.raceResults[String(round)].drivers.filter((r:any)=>r.isActive===true):archive.seasonResult.raceResults[String(round)].constructors).filter((r:any)=>canon(r.abbreviation)===code);assert.equal(target.length,1);assert.equal(price,target[0].price);quoteMatches++;if(row.OldPlayerValue===target[0].price)oldFieldMatches++;
  }
 }
 const anchors=primary.valuationChanges.map(a=>{
  const initial=feeds.get(1)!.find(r=>canon(r.DriverTLA)===a.code&&r.PositionName===a.type&&String(r.IsActive)==='1');assert.ok(initial);
  const row=(a.type==='DRIVER'?archive.seasonResult.raceResults['16'].drivers.filter((r:any)=>r.isActive===true):archive.seasonResult.raceResults['16'].constructors).find((r:any)=>canon(r.abbreviation)===a.code);assert.ok(row);
  const current=Math.round((initial.Value+a.change)*10)/10,after=Math.round((row.price+row.priceChange)*10)/10;assert.equal(current,after);
  return {...a,initialQuote:initial.Value,archiveR16Quote:row.price,archiveR16Change:row.priceChange,inferredCurrentQuote:current};
 });
 const totals=primary.totalPoints.map(p=>{const actual=history.observations.filter(r=>r.code===p.code&&r.type===p.type&&r.round<=16).reduce((s,r)=>s+r.actualPoints,0);assert.equal(actual,p.points);return {...p,archiveTotal:actual}});
 const report={season:2026,throughRound:16,verifiedField:'Value',previousSnapshotField:'OldPlayerValue',adjacentSameIdLinks:links,archiveQuoteMatches:quoteMatches,oldFieldMatches,anchors,totals,sourceHashes:sources,archiveSHA256:createHash('sha256').update(raw).digest('hex'),limitations:'Field semantics corroborated by historical chains and current primary aggregate anchors. Exact historical publication-before-lock timing remains unverified. Aggregate totals do not validate every individual label. No new model selection or activation.'};
 await writeFile('docs/official-price-field-2026-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({links,quoteMatches,oldFieldMatches,primaryAnchors:anchors.length,primaryTotals:totals.length}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
