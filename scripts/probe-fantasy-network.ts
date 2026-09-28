const URL='https://fantasy.formula1.com/feeds/v2/statistics/driverconstructors_4.json';

function summarize(value:unknown,depth=0):unknown{
 if(depth>3)return typeof value;
 if(Array.isArray(value))return {type:'array',length:value.length,sample:value.slice(0,2).map(v=>summarize(v,depth+1))};
 if(value&&typeof value==='object'){
  const obj=value as Record<string,unknown>;
  const out:Record<string,unknown>={};
  for(const [key,val] of Object.entries(obj).slice(0,30))out[key]=summarize(val,depth+1);
  return out;
 }
 return value;
}

async function main(){
 const response=await fetch(URL,{headers:{'user-agent':'Mozilla/5.0'}});
 if(!response.ok)throw new Error('Feed request failed: '+response.status);
 const json=await response.json();
 console.log('URL:',URL);
 console.log('Top-level keys:',Object.keys(json as Record<string,unknown>));
 console.log(JSON.stringify(summarize(json),null,2));
}

main().catch(error=>{console.error(error);process.exitCode=1});
