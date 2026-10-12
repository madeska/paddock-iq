const F1_ORIGIN='https://fantasy.formula1.com';
type TransferEvent={origin:string;source:unknown;data:any};
export function isF1TransferMessage(event:TransferEvent,opener:unknown,nonce:string){
 if(!opener||event.source!==opener||event.origin!==F1_ORIGIN||event.data?.type!=='PADDOCK_F1_PAYLOAD'||event.data.nonce!==nonce||event.data.payload?.format!=='paddock-iq-f1-v1')return false;
 try{return JSON.stringify(event.data.payload).length<=100000}catch{return false}
}
/** One-shot in-memory transfer. No cookies, tokens or lineup data in URLs/storage. */
export function receiveF1Transfer(win:Window,onPayload:(data:any)=>void,onError:(message:string)=>void){
 const nonce=new URLSearchParams(win.location.hash.slice(1)).get('f1-transfer');
 if(!nonce)return ()=>{};
 if(!/^[a-f0-9-]{36}$/i.test(nonce)||!win.opener){onError('Direct import connection unavailable. Sign in here, then run the F1 bookmark again, or use file import.');return ()=>{}}
 const opener=win.opener as Window;let done=false;
 const ready=()=>{if(!done)opener.postMessage({type:'PADDOCK_F1_READY',nonce},F1_ORIGIN)};
 const clearFragment=()=>win.history.replaceState(null,'',win.location.pathname+win.location.search);
 const listener=(event:MessageEvent)=>{
  if(done||!isF1TransferMessage(event,opener,nonce))return;
  done=true;cleanup();clearFragment();opener.postMessage({type:'PADDOCK_F1_ACK',nonce},F1_ORIGIN);win.opener=null;onPayload(event.data.payload);
 };
 const cleanup=()=>{done=true;win.clearInterval(timer);win.clearTimeout(timeout);win.removeEventListener('message',listener)};
 win.addEventListener('message',listener);
 const timer=win.setInterval(ready,1000);
 const timeout=win.setTimeout(()=>{cleanup();clearFragment();onError('Direct import timed out. Run the F1 bookmark again or use file import.')},90000);
 ready();return cleanup;
}
