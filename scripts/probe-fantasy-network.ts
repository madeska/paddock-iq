const URL='https://fantasy.formula1.com/feeds/drivers/16_en.json';

function keys(value:unknown){
 return value&&typeof value==='object'&&!Array.isArray(value)?Object.keys(value as Record<string,unknown>):[];
}

function preview(value:unknown,depth=0):unknown{
 if(depth>5)return '[max-depth]';
 if(Array.isArray(value))return value.slice(0,3).map(v=>preview(v,depth+1));
 if(value&&typeof value==='object'){
  const out:Record<string,unknown>={};
  for(const [k,v] of Object.entries(value as Record<string,unknown>).slice(0,40))out[k]=preview(v,depth+1);
  return out;
 }
 return value;
}

async function main(){
 const response=await fetch(URL,{headers:{'user-agent':'Mozilla/5.0'}});
 if(!response.ok)throw new Error('Feed request failed: '+response.status);
 const json=await response.json() as any;

 console.log('top keys:',keys(json));
 console.log('Data keys:',keys(json?.Data));

 const players=json?.Data?.players ?? json?.Data?.Players ?? json?.players;
 console.log('players keys:',keys(players));

 const popup=players?.['player-popup'];
 const statView=players?.['stat-view'];

 console.log('player-popup ids:',keys(popup).slice(0,30));
 console.log('stat-view ids:',keys(statView).slice(0,30));

 const antonelli=popup?.['11161'] ?? statView?.['11161'];
 console.log('\nANTONELLI 11161\n');
 console.log(JSON.stringify(preview(antonelli),null,2));

 if(!antonelli){
  console.log('\nDATA PREVIEW\n');
  console.log(JSON.stringify(preview(json?.Data),null,2));
 }
}

main().catch(error=>{console.error(error);process.exitCode=1});
