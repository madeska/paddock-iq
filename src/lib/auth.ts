import {getServerSession,type NextAuthOptions} from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import {NextResponse} from 'next/server';
import {prisma} from './prisma';
import {linkGoogleIdentity} from './google-identity';
export function authConfigured(){return Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.NEXTAUTH_SECRET&&process.env.NEXTAUTH_URL)}
export const authOptions:NextAuthOptions={
 secret:process.env.NEXTAUTH_SECRET,
 session:{strategy:'jwt',maxAge:7*24*60*60},
 pages:{signIn:'/login',error:'/login'},
 providers:[GoogleProvider({clientId:process.env.GOOGLE_CLIENT_ID??'',clientSecret:process.env.GOOGLE_CLIENT_SECRET??'',checks:['pkce','state'],authorization:{params:{scope:'openid email profile',prompt:'select_account'}}})],
 callbacks:{
  async signIn({account,profile,user}){
   if(!authConfigured()||account?.provider!=='google'||!profile)return false;
   try{const owner=await prisma.$transaction(tx=>linkGoogleIdentity(tx,profile));user.id=owner.id;return true}catch{return false}
  },
  async jwt({token,user,account}){if(account&&user)token.ownerId=user.id;return token},
  async session({session,token}){(session as typeof session&{ownerId?:string}).ownerId=typeof token.ownerId==='string'?token.ownerId:undefined;return session},
 },
};
export async function sessionOwner(){
 if(!authConfigured())return null;
 const session=await getServerSession(authOptions) as {ownerId?:string}|null;
 if(!session?.ownerId)return null;
 const user=await prisma.user.findUnique({where:{id:session.ownerId}});
 return user?.googleSubject&&user.email?user:null;
}
export async function authorizeTeamRequest(request:Request){
 const owner=await sessionOwner();
 if(!owner)return {response:NextResponse.json({error:'Sign in with Google to access your teams.'},{status:401,headers:{'Cache-Control':'no-store'}})};
 if(request.method!=='GET'&&request.headers.get('origin')!==new URL(process.env.NEXTAUTH_URL!).origin)return {response:NextResponse.json({error:'Submit this change from Paddock IQ.'},{status:403})};
 return {owner};
}
