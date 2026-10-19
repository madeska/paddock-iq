type State={round:number;completed:boolean};
type Dependencies={
 state():Promise<State>;
 scores(round:number):Promise<{forecast:State;errors:string[];verified:number}>;
 lock(round:number):Promise<Date|null>;
 generate(round:number):Promise<Response>;
};
/** Scores and rollover run before the next forecast; completed/past-lock forecasts stay frozen. */
export async function scheduledUpdate(deps:Dependencies,clock=()=>new Date()){
 const current=await deps.state();
 if(current.completed)return {status:'COMPLETED'};
 const scores=await deps.scores(current.round);
 if(scores.errors.length&&scores.verified===0)throw Error('Official score sources unavailable');
 const next=scores.forecast;
 if(next.completed)return {status:'COMPLETED'};
 const deadline=await deps.lock(next.round);
 if(!deadline||!Number.isFinite(+deadline))throw Error('Team lock unavailable');
 if(+deadline<=+clock())return {status:'LOCKED',round:next.round};
 const response=await deps.generate(next.round),forecast=await response.json();
 if(!response.ok||!forecast.ok||forecast.created===0)throw Error('Forecast update unavailable');
 return {status:'UPDATED',round:next.round,forecast};
}
