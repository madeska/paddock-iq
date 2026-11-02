export function maintenanceFixture(){
 let row:any={id:'fantasy:2026',leaseUntil:new Date(0),token:null};
 return {upsert:async()=>row,findUnique:async()=>null,updateMany:async({where,data}:any)=>{
  if(where.token!==undefined&&where.token!==row.token)return {count:0};
  if(where.leaseUntil&&row.leaseUntil>where.leaseUntil.lte)return {count:0};
  row={...row,...data};return {count:1};
 }};
}
