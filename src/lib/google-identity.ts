import type {Prisma} from '@prisma/client';
type GoogleProfile={sub?:string;email?:string;email_verified?:boolean;name?:string;hd?:string};
export async function linkGoogleIdentity(db:Prisma.TransactionClient,p:GoogleProfile){
 if(!p.sub||!p.email||p.email_verified!==true)throw Error('Verified Google identity required');
 const linked=await db.user.findUnique({where:{googleSubject:p.sub}});if(linked)return linked;
 const email=p.email.trim().toLowerCase(),existing=await db.user.findUnique({where:{email}});
 if(existing){
  if(existing.googleSubject||(!email.endsWith('@gmail.com')&&!email.endsWith('@googlemail.com')&&!p.hd))throw Error('Existing profile cannot be linked automatically');
  const changed=await db.user.updateMany({where:{id:existing.id,googleSubject:null},data:{googleSubject:p.sub}});
  if(changed.count!==1)throw Error('Profile ownership changed; sign in again');
  return {...existing,googleSubject:p.sub};
 }
 return db.user.create({data:{googleSubject:p.sub,email,name:p.name}});
}
