type Market={round:number;complete:boolean;seasonCompleted?:boolean};
/** False means retry on the next poll; never claim readiness from a successful POST alone. */
export async function prepareForecast(load:()=>Promise<Market|undefined>,refresh:(round:number)=>Promise<Market|undefined>):Promise<boolean>{
 const market=await load();if(!market)return false;
 if(market.seasonCompleted||market.complete)return true;
 const generated=await refresh(market.round);
 return Boolean(generated&&generated.round===market.round&&(generated.complete||generated.seasonCompleted));
}
