import {WeekendSourceUnavailable} from './openf1-weekend';
export type UpdateFailureCode='SCORE_SOURCE_UNAVAILABLE'|'TEAM_LOCK_UNAVAILABLE'|'FORECAST_GENERATION_FAILED'|'FORECAST_READBACK_FAILED'|'WEEKEND_SOURCE_UNAVAILABLE';
export class UpdateFailure extends Error{
 constructor(readonly code:UpdateFailureCode,readonly round:number){super(code);this.name='UpdateFailure'}
}
export function publicUpdateFailure(error:unknown){return error instanceof UpdateFailure?{code:error.code,round:error.round}:error instanceof WeekendSourceUnavailable?{code:error.code}:{code:'UPDATE_FAILED'}}
