/** Research only: no target-round outcome or price change is read. Provenance of the initial quote remains caller responsibility. */
export function causalQuoteFromPriorChanges(initial:number,changes:readonly {round:number;change:number}[],targetRound:number){
 if(!Number.isFinite(initial)||initial<=0||!Number.isInteger(targetRound)||targetRound<1)throw Error('Invalid initial quote or cutoff');
 const known=new Map<number,number>();for(const row of changes){if(row.round>=targetRound)continue;if(!Number.isInteger(row.round)||row.round<1||!Number.isFinite(row.change)||known.has(row.round))throw Error('Invalid or duplicated historical price change');known.set(row.round,row.change)}
 let quote=initial;for(let round=1;round<targetRound;round++){const change=known.get(round);if(change===undefined)throw Error('Missing prior price change');quote=Math.round((quote+change)*1000000)/1000000;if(!Number.isFinite(quote)||quote<=0)throw Error('Nonpositive reconstructed quote')}
 return quote;
}
