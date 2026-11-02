/** Next can return empty/HTML error pages before an API handler finishes. Never expose parser errors or server HTML. */
export async function readApiJson(response:Response):Promise<any>{
 const body=await response.text();
 try{if(body.trim())return JSON.parse(body)}catch{}
 if(!response.ok)throw Error(`Server error (HTTP ${response.status}). Please retry. If it continues, check the server connection.`);
 throw Error('Invalid server response. Please reload the page and try again.');
}
