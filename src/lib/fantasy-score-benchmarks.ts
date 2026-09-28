import {scoreDriverWeekend} from './fantasy-score-calculator';
export type ScoreBenchmark={label:string;expected:number;input:Parameters<typeof scoreDriverWeekend>[0]};
/**
 * Known public totals used to validate reconstructed weekend inputs.
 * Inputs stay separate because overtakes / DotD / FL must be sourced, never guessed.
 */
export function validateBenchmarks(rows:ScoreBenchmark[]){
 return rows.map(r=>{const actual=scoreDriverWeekend(r.input).total;return {...r,actual,pass:actual===r.expected}});
}
