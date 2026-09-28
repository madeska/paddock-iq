const BASE='https://fantasy.formula1.com/feeds/drivers';

async function fetchRound(round:number){
 const url=BASE+'/'+round+'_en.json';
 const response=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}});
 if(!response.ok)return {round,status:response.status,items:[] as any[]};
 const json=await response.json() as any;
 const items=Array.isArray(json?.Data?.Value)?json.Data.Value:[];
 return {round,status:response.status,items};
}

async function main(){
 for(const round of [1,2,14,15,16]){
  const data=await fetchRound(round);
  const drivers=data.items.filter((x:any)=>x.PositionName==='DRIVER');
  const constructors=data.items.filter((x:any)=>x.PositionName==='CONSTRUCTOR');
  const ant=drivers.find((x:any)=>x.DriverTLA==='ANT'||x.PlayerId==='11161');
  const ver=drivers.find((x:any)=>x.DriverTLA==='VER');
  const mer=constructors.find((x:any)=>String(x.TeamName).toUpperCase().includes('MERCEDES'));

  console.log('\nROUND',round,'status',data.status,'items',data.items.length,'drivers',drivers.length,'constructors',constructors.length);
  if(ant)console.log('ANT',{PlayerId:ant.PlayerId,GamedayPoints:ant.GamedayPoints,OverallPpints:ant.OverallPpints,OldPlayerValue:ant.OldPlayerValue,Value:ant.Value});
  if(ver)console.log('VER',{PlayerId:ver.PlayerId,GamedayPoints:ver.GamedayPoints,OverallPpints:ver.OverallPpints,OldPlayerValue:ver.OldPlayerValue,Value:ver.Value});
  if(mer)console.log('MER',{PlayerId:mer.PlayerId,GamedayPoints:mer.GamedayPoints,OverallPpints:mer.OverallPpints,OldPlayerValue:mer.OldPlayerValue,Value:mer.Value});
  else console.log('constructor sample: none in this feed');
 }
}

main().catch(error=>{console.error(error);process.exitCode=1});
