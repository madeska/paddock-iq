import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildTreeForecastFrames,TREE_FEATURE_NAMES} from './tree-forecast-frames';
import type {ReplayScore} from '../src/lib/production-history-replay';
import type {ArchivedFantasyPrice} from '../src/lib/fantasy-price-archive';
type Context={round:number;sprint:boolean;lockAt:string;practice:null|{endedAt:string;positions:{code:string;position:number}[]}};
type Input={season:number;round:number;sourceCapturedAt:string;sourceEvidence:unknown[];lineups?:{teamNo:number;drivers:string[];constructors:string[];x2:string}[];scores:ReplayScore[];quotes:ArchivedFantasyPrice[];contexts:Context[]};
/** Input is normalized source data, not hand-entered tree features. Provenance remains auditable. */
async function main(){
 const [inputPath,outputPath]=process.argv.slice(2);if(!inputPath||!outputPath)throw Error('Usage: tsx scripts/export-prospective-tree-frames.ts SOURCE.json OUTPUT.json');
 const raw=await readFile(inputPath),source=JSON.parse(raw.toString()) as Input;
 if(source.season!==2026||!Number.isInteger(source.round)||source.round<18||source.round>23)throw Error('Ineligible prospective scope');
 const now=Date.now(),captured=Date.parse(source.sourceCapturedAt);
 if(!Number.isFinite(captured)||captured>now||!source.sourceEvidence?.length)throw Error('Missing source evidence or invalid capture time');
 if(!Array.isArray(source.scores)||!Array.isArray(source.quotes)||!Array.isArray(source.contexts))throw Error('Missing normalized source arrays');
 if(source.scores.some(r=>r.season!==2026||r.round>=source.round))throw Error('Source contains target/future scores');
 if(source.quotes.some(r=>r.round>source.round))throw Error('Source contains future quotes');
 const contexts=new Map<number,Context>();
 for(const c of source.contexts){
  if(!Number.isInteger(c.round)||c.round<2||c.round>source.round||contexts.has(c.round)||typeof c.sprint!=='boolean'||!Number.isFinite(Date.parse(c.lockAt)))throw Error('Invalid context identity');
  if(c.practice){
   const end=Date.parse(c.practice.endedAt);if(!Number.isFinite(end)||end>=Math.min(captured,Date.parse(c.lockAt)))throw Error('Practice must finish before forecast cutoff');
   const seen=new Set<string>();for(const p of c.practice.positions){if(!p.code||seen.has(p.code)||!Number.isInteger(p.position)||p.position<1||p.position>22)throw Error('Invalid practice positions');seen.add(p.code)}
  }
  contexts.set(c.round,c);
 }
 const target=contexts.get(source.round);if(!target||now>=Date.parse(target.lockAt))throw Error('Missing target context or lock already passed');
 const protocol=JSON.parse(await readFile('docs/driver-only-tree-prospective-protocol.json','utf8'));
 if(captured<Date.parse(protocol.frozenAt))throw Error('Source captured before prospective freeze');
 const training:any[]=[],missingOutcomes:any[]=[];
 for(let round=2;round<source.round;round++){
  const context=contexts.get(round);if(!context)throw Error('Missing historical context R'+round);
  const frames=buildTreeForecastFrames(source.scores,source.quotes,{season:2026,round,sprint:context.sprint,practice:context.practice?{isSprint:context.sprint,positions:new Map(context.practice.positions.map(p=>[p.code,p.position]))}:null});
  for(const frame of frames){const actual=source.scores.find(r=>r.round===round&&r.code===frame.code&&r.type===frame.type)?.actualPoints;if(actual===undefined){missingOutcomes.push({round,code:frame.code,type:frame.type});continue}training.push({...frame,actual})}
 }
 const targets=buildTreeForecastFrames(source.scores,source.quotes,{season:2026,round:source.round,sprint:target.sprint,practice:target.practice?{isSprint:target.sprint,positions:new Map(target.practice.positions.map(p=>[p.code,p.position]))}:null});
 const targetRoster=source.quotes.filter(r=>r.round===source.round);
 const missingTargets=targetRoster.filter(r=>!targets.some(t=>t.code===r.code&&t.type===r.type)).map(r=>({code:r.code,type:r.type,reason:'No own historical scores; incumbent does not forecast'}));
 const output={season:2026,round:source.round,lockAt:target.lockAt,sourceCapturedAt:source.sourceCapturedAt,sourceSHA256:createHash('sha256').update(raw).digest('hex'),sourceEvidence:source.sourceEvidence,...(source.lineups?{lineups:source.lineups.map(({teamNo,drivers,constructors,x2})=>({teamNo,drivers,constructors,x2}))}:{}),featureNames:TREE_FEATURE_NAMES,training,targets,missingOutcomes,missingTargets,status:'Source/quote timing audit required before validation; shared production frame export, no activation'};
 await writeFile(outputPath,JSON.stringify(output,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({training:training.length,targets:targets.length,missingTargets,missingOutcomes,output:outputPath}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
