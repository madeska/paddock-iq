import nextEnv from '@next/env';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {realpathSync} from 'node:fs';
export function deploymentProblems(env){
 const required=['DATABASE_URL','NEXTAUTH_URL','NEXTAUTH_SECRET','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','ADMIN_EMAILS'];
 const problems=required.filter(key=>!env[key]?.trim()).map(key=>`${key} is required`);
 if(env.NEXTAUTH_URL){try{const url=new URL(env.NEXTAUTH_URL);if(url.protocol!=='https:'||url.hostname==='localhost'||url.hostname==='127.0.0.1'||url.pathname!=='/'||url.search||url.hash||url.username||url.password)problems.push('NEXTAUTH_URL must be the public HTTPS origin')}catch{problems.push('NEXTAUTH_URL must be a valid URL')}}
 if(env.DATABASE_URL){try{const url=new URL(env.DATABASE_URL);if(!['postgres:','postgresql:'].includes(url.protocol)||!['require','verify-ca','verify-full'].includes(url.searchParams.get('sslmode')))problems.push('DATABASE_URL must be PostgreSQL with SSL configured')}catch{problems.push('DATABASE_URL must be a valid PostgreSQL URL')}}
 if(env.NEXTAUTH_SECRET&&env.NEXTAUTH_SECRET.length<32)problems.push('NEXTAUTH_SECRET must contain at least 32 characters');
 if(env.MARKET_ADMIN_KEY&&env.MARKET_ADMIN_KEY.length<32)problems.push('MARKET_ADMIN_KEY must be empty or contain at least 32 characters');
 if(env.ADMIN_EMAILS&&env.ADMIN_EMAILS.split(',').some(value=>!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())))problems.push('ADMIN_EMAILS must contain comma-separated email addresses');
 return problems;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(realpathSync(resolve(process.argv[1]))).href){
 nextEnv.loadEnvConfig(process.env.PADDOCK_ENV_DIR??process.cwd(),false,{info(){},error(){}});
 if(process.argv.includes('--vercel-only')&&process.env.VERCEL_ENV!=='production'){console.log('Production environment validation skipped outside Vercel production.');}
 else{const problems=deploymentProblems(process.env);if(problems.length){console.error('Deployment configuration incomplete:\n'+problems.map(problem=>'- '+problem).join('\n'));process.exitCode=1}else console.log('Production environment configuration passed. Values are not printed.');}
}
