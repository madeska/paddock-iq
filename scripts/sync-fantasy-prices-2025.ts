import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {normalizeFantasyPriceArchive} from '../src/lib/fantasy-price-archive';
const SOURCE='https://f1fantasytools.com/api/statistics/2025';
const EXPECTED='8f1603e517c0506e255ca1f274ce83297288fc24e870cd1e2dc56e37a73ff162';
async function main(){
 const path=process.argv[2];if(!path)throw Error('Pass the pinned source snapshot file');
 const raw=await readFile(path);if(createHash('sha256').update(raw).digest('hex')!==EXPECTED)throw Error('Price source snapshot hash mismatch');
 const payload=JSON.parse(raw.toString('utf8')),observations=normalizeFantasyPriceArchive(payload);
 const anchors=[{round:9,code:'NOR',price:31},{round:9,code:'SAI',price:8.7},{round:9,code:'BEA',price:7.5},{round:9,code:'HAD',price:5.5},{round:9,code:'ALO',price:4.5},{round:9,code:'MCL',price:32.4},{round:9,code:'RBR',price:27.2},{round:12,code:'HAD',price:6.9},{round:12,code:'SAU',price:7.5}];
 for(const anchor of anchors)if(observations.find(r=>r.round===anchor.round&&r.code===anchor.code)?.priceBefore!==anchor.price)throw Error('Official pre-event anchor mismatch');
 let checkedTransitions=0;
 for(let round=1;round<24;round++)for(const kind of ['drivers','constructors'])for(const row of payload.seasonResult.raceResults[round][kind]){
  const next=payload.seasonResult.raceResults[round+1][kind].find((r:any)=>r.id===row.id);
  if(!next||row.isActive===false||next.isActive===false)continue;
  if(typeof row.priceChange!=='number'||Math.abs(row.price+row.priceChange-next.price)>1e-6)throw Error('Historical price transition mismatch');checkedTransitions++;
 }
 const prior=JSON.parse(await readFile('src/data/fantasy-totals-2025.json','utf8'));let checkedTotals=0;
 const canonical=(code:string)=>({AST:'AMR',HAA:'HAS',KCK:'SAU',RED:'RBR',VRB:'RB'} as Record<string,string>)[code]??code;
 for(const row of prior.observations){const kind=row.type==='DRIVER'?'drivers':'constructors',matches=payload.seasonResult.raceResults[row.round][kind].filter((r:any)=>canonical(r.abbreviation)===row.code&&r.isActive!==false);if(matches.length!==1||matches[0].totalPoints!==row.actualPoints)throw Error('Previously audited score mismatch');checkedTotals++}
 const result={schemaVersion:1,season:2025,source:SOURCE,sourceSHA256:EXPECTED,note:'Retrospective third-party historical quotes. price is pre-event, supported by official pre-lock article anchors and consecutive price-change identities. Snapshot outcomes excluded. No reserved R15–21 forecast errors computed.',audit:{checkedTransitions,checkedTotals,anchors},observations};
 await writeFile('src/data/fantasy-prices-2025.json',JSON.stringify(result,null,2)+'\n');console.log({prices:observations.length,checkedTransitions,checkedTotals,officialAnchors:anchors.length});
}
main().catch(e=>{console.error(e);process.exitCode=1});
