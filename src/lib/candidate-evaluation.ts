import type {buildCandidateCapture} from './candidate-capture';
export function evaluateCandidateCapture(capture:Pick<ReturnType<typeof buildCandidateCapture>,'protocol'|'season'|'round'|'capturedAt'|'deadline'|'rows'>,market:{season:number;round:number;assets:{code:string;type:string;actualPoints:number|null}[]}){
 if(capture.protocol!=='normal-driver-classified-progress-v1'||capture.season!==market.season||capture.round!==market.round||!Number.isFinite(Date.parse(capture.capturedAt))||!Number.isFinite(Date.parse(capture.deadline))||Date.parse(capture.capturedAt)>=Date.parse(capture.deadline)||!capture.rows.length)throw Error('Invalid capture identity or timing');
 const keys=capture.rows.map(r=>r.type+':'+r.code);if(new Set(keys).size!==keys.length||capture.rows.some(r=>!Number.isFinite(r.incumbent)||!Number.isFinite(r.candidate)))throw Error('Invalid captured forecasts');
 const rows=capture.rows.map(r=>{const actuals=market.assets.filter(a=>a.code===r.code&&a.type===r.type);if(actuals.length>1)throw Error('Ambiguous actual score');return {...r,actual:actuals[0]?.actualPoints??null}});
 const pending=rows.filter(r=>r.actual===null||!Number.isFinite(r.actual)).map(r=>r.code);
 if(pending.length)return {status:'WAITING' as const,season:capture.season,round:capture.round,pending,metrics:null};
 const metric=(items:typeof rows,key:'incumbent'|'candidate')=>items.length?{n:items.length,MAE:items.reduce((s,r)=>s+Math.abs(r[key]-r.actual!),0)/items.length,RMSE:Math.sqrt(items.reduce((s,r)=>s+(r[key]-r.actual!)**2,0)/items.length),Bias:items.reduce((s,r)=>s+r[key]-r.actual!,0)/items.length}:null;
 return {status:'READY' as const,season:capture.season,round:capture.round,pending,metrics:['ALL','DRIVER','CONSTRUCTOR'].map(type=>{const subset=rows.filter(r=>type==='ALL'||r.type===type);return {type,incumbent:metric(subset,'incumbent'),candidate:metric(subset,'candidate')}})};
}
