export type RememberedProfile={email:string;teamId?:string;season?:number};
const PROFILE_KEY='paddock-iq:profile';
export function getRememberedProfile():RememberedProfile|null {
 try{const p=JSON.parse(window.localStorage.getItem(PROFILE_KEY)||'null');if(!p||typeof p.email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))return null;return {email:p.email,teamId:typeof p.teamId==='string'?p.teamId:undefined,season:Number.isInteger(p.season)?p.season:undefined}}catch{return null}
}
export function rememberProfile(profile:RememberedProfile){
 const email=profile.email.trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return;
 try{window.localStorage.setItem(PROFILE_KEY,JSON.stringify({...profile,email}))}catch{/* Saving remains available when browser storage is disabled. */}
}
