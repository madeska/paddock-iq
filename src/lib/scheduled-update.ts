import {UpdateFailure} from './update-failure';
type State={round:number;completed:boolean};
type Dependencies={
 state():Promise<State>;
 scores(round:number):Promise<{forecast:State;errors:string[];verified:number}>;
 lock(round:number):Promise<Date|null>;
 generate(round:number):Promise<Response>;
 verify(round:number):Promise<{ok:boolean}>;
};
/** Scores and rollover run before the next forecast; completed/past-lock forecasts stay frozen. */
export async function scheduledUpdate(deps:Dependencies,clock=()=>new Date()){
 const current=await deps.state();
 if(current.completed)return {status:'COMPLETED'};
 const scores=await deps.scores(current.round);
 if(scores.errors.length&&scores.verified===0)throw new UpdateFailure('SCORE_SOURCE_UNAVAILABLE',current.round);
 const next=scores.forecast;
 if(next.completed)return {status:'COMPLETED'};
 const deadline=await deps.lock(next.round);
 if(!deadline||!Number.isFinite(+deadline))throw new UpdateFailure('TEAM_LOCK_UNAVAILABLE',next.round);
 if(+deadline<=+clock())return {status:'LOCKED',round:next.round};
 const response=await deps.generate(next.round),forecast=await response.json();
 if(!response.ok||!forecast.ok||forecast.created===0)throw new UpdateFailure('FORECAST_GENERATION_FAILED',next.round);
 if(!(await deps.verify(next.round)).ok)throw new UpdateFailure('FORECAST_READBACK_FAILED',next.round);
 return {status:'UPDATED',round:next.round,forecast};
}
