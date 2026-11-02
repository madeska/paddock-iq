export function databaseConnectionUnavailable(error:unknown):boolean{
 if(!error||typeof error!=='object')return false;
 const codes=['P1001','P1002','P1017'];
 return ('code' in error&&codes.includes(String(error.code)))||('errorCode' in error&&codes.includes(String(error.errorCode)));
}
