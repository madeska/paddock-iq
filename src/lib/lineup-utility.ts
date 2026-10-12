export type LineupAsset={code:string;type:'DRIVER'|'CONSTRUCTOR';price:number;points:number;boostPoints?:number|null};
export type PointsLineup={drivers:string[];constructors:string[];boost:string;cost:number;points:number};
/** Exhaustive points-mode benchmark. Matches the UI's separate boost forecast; lexical ties make replay reproducible. */
export function selectPointsLineup(roster:readonly LineupAsset[],budget:number):PointsLineup|null{
 if(!Number.isFinite(budget)||budget<0)throw Error('Invalid budget');
 const identities=new Set<string>();
 for(const r of roster){
  const key=`${r.type}:${r.code}`;
  if(identities.has(key)||!r.code||!['DRIVER','CONSTRUCTOR'].includes(r.type)||!Number.isFinite(r.price)||r.price<0||!Number.isFinite(r.points)||(r.boostPoints!=null&&!Number.isFinite(r.boostPoints)))throw Error('Invalid lineup roster');
  identities.add(key);
 }
 const drivers=roster.filter(r=>r.type==='DRIVER').sort((a,b)=>a.code.localeCompare(b.code));
 const constructors=roster.filter(r=>r.type==='CONSTRUCTOR').sort((a,b)=>a.code.localeCompare(b.code));
 const cents=(x:number)=>Math.round(x*100),cap=cents(budget);
 const pairs:{rows:LineupAsset[];cost:number;points:number}[]=[];
 for(let i=0;i<constructors.length;i++)for(let j=i+1;j<constructors.length;j++){
  const rows=[constructors[i],constructors[j]],cost=rows.reduce((s,r)=>s+cents(r.price),0);
  if(cost<=cap)pairs.push({rows,cost,points:rows.reduce((s,r)=>s+r.points,0)});
 }
 let best:PointsLineup|null=null;
 function visit(start:number,rows:LineupAsset[],cost:number,points:number){
  if(rows.length===5){
   const boost=rows.reduce((a,b)=>(b.boostPoints??b.points)>(a.boostPoints??a.points)?b:a);
   for(const pair of pairs){
    if(cost+pair.cost>cap)continue;
    const value=points+pair.points+(boost.boostPoints??boost.points);
    if(!best||value>best.points)best={drivers:rows.map(r=>r.code),constructors:pair.rows.map(r=>r.code),boost:boost.code,cost:(cost+pair.cost)/100,points:value};
   }
   return;
  }
  for(let i=start;i<=drivers.length-(5-rows.length);i++){
   const row=drivers[i],next=cost+cents(row.price);
   if(next<=cap)visit(i+1,[...rows,row],next,points+row.points);
  }
 }
 visit(0,[],0,0);return best;
}
