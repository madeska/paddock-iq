import {NextResponse} from 'next/server';
import {prisma} from './prisma';
import {withMaintenanceLease} from './maintenance-updates';

class FailedUpdate extends Error{constructor(readonly response:Response){super('Update unsuccessful')}}
export async function maintenanceResponse(work:(token:string)=>Promise<Response>,forecast=false){
 try{
  const result=await withMaintenanceLease(prisma,async token=>{
   const response=await work(token);
   if(!response.ok)throw new FailedUpdate(response);
   const data=await response.clone().json();
   if(forecast&&(!data.ok||data.created===0))throw new FailedUpdate(NextResponse.json({error:'Forecast incomplete; retry the update.'},{status:502}));
   return {value:response};
  });
  return result.busy?NextResponse.json({error:'A data update is already running. Please retry shortly.'},{status:409}):result.value;
 }catch(error){
  return error instanceof FailedUpdate?error.response:NextResponse.json({error:'Data update unavailable. Please retry later.'},{status:503});
 }
}
