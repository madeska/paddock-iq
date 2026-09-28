/** Transfer accounting is configurable: confirm season-specific carry cap before production. */
export function transferAccounting(free:number, changes:number, penaltyPerExtra=10, carryCap=3){
 if(!Number.isInteger(free)||free<0||!Number.isInteger(changes)||changes<0||!Number.isFinite(penaltyPerExtra)||penaltyPerExtra<0||!Number.isInteger(carryCap)||carryCap<0)throw Error('Invalid transfer rules');
 const paid=Math.max(0,changes-free);
 return {paid,penalty:paid*penaltyPerExtra,unused:Math.max(0,free-changes),projectedNext:Math.min(carryCap,Math.max(0,free-changes)+1)};
}
