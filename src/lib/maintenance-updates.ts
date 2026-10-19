import {randomUUID,timingSafeEqual} from 'node:crypto';

const KEY='fantasy:2026';
const LEASE_MS=10*60*1000; // Longer than the 300-second Vercel function lifetime.
type Store={maintenanceState:{upsert(args:any):Promise<any>;updateMany(args:any):Promise<{count:number}>}};
type ForecastContext={round:number;forecastAt:string;[key:string]:unknown};

/** One database lease covers manual and scheduled writers across all function instances. */
export async function withMaintenanceLease<T>(db:Store,work:(token:string)=>Promise<{value:T}>) {
 const now=new Date(),token=randomUUID();
 await db.maintenanceState.upsert({where:{id:KEY},create:{id:KEY},update:{}});
 const acquired=await db.maintenanceState.updateMany({where:{id:KEY,leaseUntil:{lte:now}},data:{token,leaseUntil:new Date(+now+LEASE_MS),status:'RUNNING',lastStartedAt:now}});
 if(!acquired.count)return {busy:true as const};
 try{
  const result=await work(token);
  await db.maintenanceState.updateMany({where:{id:KEY,token},data:{token:null,leaseUntil:new Date(0),status:'SUCCEEDED',lastSucceededAt:new Date()}});
  return {busy:false as const,...result};
 }catch(error){
  await db.maintenanceState.updateMany({where:{id:KEY,token},data:{token:null,leaseUntil:new Date(0),status:'FAILED',lastFailedAt:new Date()}});
  throw error;
 }
}

export function cronAuthorized(request:Request,secret:string|undefined){
 if(!secret||secret.length<32)return false;
 const provided=Buffer.from(request.headers.get('authorization')??''),expected=Buffer.from('Bearer '+secret);
 return provided.length===expected.length&&timingSafeEqual(provided,expected);
}

export function forecastFreshness(rows:{forecastCreatedAt?:Date|string|null}[],deadline:Date|null,now=new Date()){
 const times=rows.map(row=>row.forecastCreatedAt?+new Date(row.forecastCreatedAt):NaN);
 const complete=rows.length>0&&times.every(Number.isFinite);
 const oldestAt=complete?new Date(Math.min(...times)).toISOString():null;
 const latestAt=times.some(Number.isFinite)?new Date(Math.max(...times.filter(Number.isFinite))).toISOString():null;
 const locked=deadline!=null&&Number.isFinite(+deadline)&&+deadline<=+now;
 const status=!complete?'MISSING':locked?'LOCKED':+now-Date.parse(oldestAt!)>60*60*1000?'STALE':'CURRENT';
 return {status,oldestAt,latestAt,checkedAt:now.toISOString()};
}

export function savedForecastContext(result:any):ForecastContext{
 return {round:result.round,forecastAt:result.forecastAt,weekendLock:result.weekendLock,practiceSnapshot:result.practiceSnapshot,weekendImpact:result.weekendImpact,weekendNews:result.weekendNews};
}
