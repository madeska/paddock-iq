/** Verified 2026 archived official feed semantics: Value is this round's quote; OldPlayerValue is the preceding snapshot quote. */
export function officialHistoricalFantasyPrice(row:{Value?:unknown;OldPlayerValue?:unknown}):number{
 const value=row.Value;
 if(typeof value!=='number'&&typeof value!=='string'||typeof value==='string'&&value.trim()==='')throw Error('Missing official historical quote');
 const price=Number(value);
 if(!Number.isFinite(price)||price<=0)throw Error('Invalid official historical quote');
 return price;
}
