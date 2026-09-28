const PAGE='https://fantasy.formula1.com/en/statistics/details?tab=driver&filter=fPoints';
const ORIGIN='https://fantasy.formula1.com';

function absolute(src:string){
 try{return new URL(src,ORIGIN).toString()}catch{return null}
}

function snippets(text:string,needle:string,radius=220){
 const out:string[]=[];
 const lower=text.toLowerCase(),n=needle.toLowerCase();
 let pos=0;
 while((pos=lower.indexOf(n,pos))>=0&&out.length<12){
  out.push(text.slice(Math.max(0,pos-radius),Math.min(text.length,pos+n.length+radius)).replace(/\s+/g,' '));
  pos+=n.length;
 }
 return out;
}

async function main(){
 const htmlRes=await fetch(PAGE,{headers:{'user-agent':'Mozilla/5.0'}});
 if(!htmlRes.ok)throw new Error('Page fetch failed: '+htmlRes.status);
 const html=await htmlRes.text();

 const scripts=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
  .map(m=>absolute(m[1]))
  .filter((x):x is string=>Boolean(x));
 console.log('scripts:',scripts.length);

 const needles=['driverconstructors','/feeds/','playerid','statistics','breakdown','accordion','statvalue'];
 let hits=0;

 for(const url of [...new Set(scripts)]){
  let text='';
  try{
   const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}});
   if(!r.ok)continue;
   text=await r.text();
  }catch{continue}

  const matched=needles.filter(n=>text.toLowerCase().includes(n.toLowerCase()));
  if(!matched.length)continue;
  hits++;
  console.log('\nBUNDLE',url);
  console.log('MATCHES',matched.join(', '));
  for(const needle of matched){
   for(const s of snippets(text,needle,260).slice(0,4))console.log('\n['+needle+']',s);
  }
 }

 console.log('\nmatched bundles:',hits);
}

main().catch(error=>{console.error(error);process.exitCode=1});
