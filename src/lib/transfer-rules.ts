/** 2026 F1 Fantasy: 2 free transfers per GP, with at most 1 unused transfer carried over. */
export function transferAccounting(free:number,changes:number,penaltyPerExtra=10){
 if(!Number.isInteger(free)||free<0||!Number.isInteger(changes)||changes<0||!Number.isFinite(penaltyPerExtra)||penaltyPerExtra<0)throw Error('Invalid transfer rules');
 const paid=Math.max(0,changes-free);
 const unused=Math.max(0,free-changes);
 const carried=unused>0?1:0;
 return {
  paid,
  penalty:paid*penaltyPerExtra,
  unused,
  carried,
  projectedNext:2+carried
 };
}
