const URL='https://fantasy.formula1.com/feeds/v2/statistics/driverconstructors_4.json';

function truncate(value:unknown,depth=0):unknown{
 if(depth>6)return '[max-depth]';
 if(Array.isArray(value))return value.slice(0,3).map(v=>truncate(v,depth+1));
 if(value&&typeof value==='object'){
  const obj=value as Record<string,unknown>;
  const out:Record<string,unknown>={};
  for(const [key,val] of Object.entries(obj).slice(0,50))out[key]=truncate(val,depth+1);
  return out;
 }
 if(typeof value==='string'&&value.length>300)return value.slice(0,300)+'…';
 return value;
}

async function main(){
 const response=await fetch(URL,{headers:{'user-agent':'Mozilla/5.0'}});
 if(!response.ok)throw new Error('Feed request failed: '+response.status);
 const json=await response.json() as any;
 console.log('season:',json?.Data?.season);
 console.log('driver blocks:',Array.isArray(json?.Data?.driver)?json.Data.driver.length:0);
 console.log('constructor blocks:',Array.isArray(json?.Data?.constructor)?json.Data.constructor.length:0);
 console.log('\nFIRST DRIVER BLOCK\n');
 console.log(JSON.stringify(truncate(json?.Data?.driver?.[0]),null,2));
 console.log('\nFIRST CONSTRUCTOR BLOCK\n');
 console.log(JSON.stringify(truncate(json?.Data?.constructor?.[0]),null,2));
}

main().catch(error=>{console.error(error);process.exitCode=1});
