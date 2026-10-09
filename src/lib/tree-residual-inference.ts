/** Research-only numerical inference. No API imports or candidate activation. */
export type ResidualTreeNode=Readonly<{leaf:true;value:number}|{leaf:false;feature:number;threshold:number;left:number;right:number}>;
export type TreeResidualModel=Readonly<{schemaVersion:1;policy:'driver-only-tree-half-v1';scikitLearn:'1.7.2';featureCount:10;season:number;beforeRound:number;baseValue:number;trees:readonly (readonly ResidualTreeNode[])[]}>;
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
const integer=(x:unknown):x is number=>finite(x)&&Number.isInteger(x);
export function decodeTreeResidualModel(input:unknown):TreeResidualModel{
 const raw=input as any;
 if(!raw||raw.schemaVersion!==1||raw.policy!=='driver-only-tree-half-v1'||raw.scikitLearn!=='1.7.2'||raw.featureCount!==10||!integer(raw.season)||raw.season<2023||raw.season>2026||!integer(raw.beforeRound)||raw.beforeRound<2||raw.beforeRound>24||!finite(raw.baseValue)||!Array.isArray(raw.trees)||raw.trees.length!==60)throw Error('Invalid residual model');
 const trees=raw.trees.map((nodes:unknown)=>{
  if(!Array.isArray(nodes)||!nodes.length||nodes.length>7)throw Error('Invalid residual tree size');
  const parsed:ResidualTreeNode[]=nodes.map((node:any)=>{
   if(node?.leaf===true&&finite(node.value))return Object.freeze({leaf:true,value:node.value});
   if(node?.leaf===false&&integer(node.feature)&&node.feature>=0&&node.feature<10&&finite(node.threshold)&&integer(node.left)&&integer(node.right)&&node.left>=0&&node.right>=0&&node.left<nodes.length&&node.right<nodes.length)return Object.freeze({leaf:false,feature:node.feature,threshold:node.threshold,left:node.left,right:node.right});
   throw Error('Invalid residual tree node');
  });
  const visited=new Set<number>();
  const walk=(index:number)=>{if(visited.has(index))throw Error('Invalid residual tree cycle or shared child');visited.add(index);const node=parsed[index];if(!node.leaf){walk(node.left);walk(node.right)}};
  walk(0);if(visited.size!==parsed.length)throw Error('Invalid residual tree unreachable nodes');
  return Object.freeze(parsed);
 });
 return Object.freeze({schemaVersion:1,policy:'driver-only-tree-half-v1',scikitLearn:'1.7.2',featureCount:10,season:raw.season,beforeRound:raw.beforeRound,baseValue:raw.baseValue,trees:Object.freeze(trees)});
}
export function predictTreeResidual(model:TreeResidualModel,features:readonly number[],context:{season:number;round:number}):number{
 if(context.season!==model.season||context.round!==model.beforeRound)throw Error('Residual model forecast identity mismatch');
 if(features.length!==model.featureCount||!features.every(finite))throw Error('Invalid residual features');
 let result=model.baseValue;
 for(const tree of model.trees){
  let index=0,node=tree[index];
  while(!node.leaf){index=features[node.feature]<=node.threshold?node.left:node.right;node=tree[index]}
  result+=node.value;
 }
 if(!Number.isFinite(result))throw Error('Nonfinite residual prediction');
 return result;
}
/** Frozen driver-only policy; constructor forecasts are returned without correction. */
export function applyTreeResidualCorrection(model:TreeResidualModel,frame:{season:number;round:number;type:'DRIVER'|'CONSTRUCTOR';incumbent:number;x:readonly number[]}):number{
 if(frame.season!==model.season||frame.round!==model.beforeRound)throw Error('Residual model forecast identity mismatch');
 if(!Number.isFinite(frame.incumbent)||!['DRIVER','CONSTRUCTOR'].includes(frame.type))throw Error('Invalid incumbent frame');
 if(frame.type==='CONSTRUCTOR')return frame.incumbent;
 const residual=predictTreeResidual(model,frame.x,frame);
 const rounded=Math.round((frame.incumbent+.5*residual)*10)/10;
 if(!Number.isFinite(rounded))throw Error('Nonfinite corrected forecast');
 return rounded===0?0:rounded;
}
