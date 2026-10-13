export async function readLimitedJson(request:Request,limit=100_000):Promise<any>{
 const reader=request.body?.getReader();if(!reader)throw Error('Request body is required.');
 const decoder=new TextDecoder();let size=0,text='';
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('Request payload is too large.')}text+=decoder.decode(value,{stream:true})}
 text+=decoder.decode();return JSON.parse(text);
}
