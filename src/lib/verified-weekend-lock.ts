import type {PrismaClient} from '@prisma/client';
import type {CachedWeekendLock} from './openf1-weekend';
/** Only our own previously provider-verified same-round context is eligible, never a typed deadline. */
export async function readVerifiedWeekendLock(db:Pick<PrismaClient,'maintenanceState'>,season:number,round:number):Promise<CachedWeekendLock|null>{
 if(season!==2026)return null;
 const row=await db.maintenanceState.findUnique({where:{id:'fantasy:2026'},select:{forecastRound:true,forecastAt:true,forecastContext:true}});
 const context=row?.forecastContext as any,lock=context?.weekendLock;
 if(row?.forecastRound!==round||context?.round!==round||!row.forecastAt||typeof lock?.source!=='string'||!lock.source.startsWith('Fantasy Tools calendar + OpenF1 session start;'))return null;
 return {season,round,deadline:lock.deadline,verifiedAt:row.forecastAt.toISOString(),isSprint:typeof lock.isSprint==='boolean'?lock.isSprint:typeof context.practiceSnapshot?.isSprint==='boolean'?context.practiceSnapshot.isSprint:null};
}
