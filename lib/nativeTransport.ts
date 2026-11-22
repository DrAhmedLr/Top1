/** Native API requests are confined to the configured HTTPS API origin. */
export function nativeApiFetch(request:typeof fetch,apiOrigin:string,getToken:()=>Promise<string|null>):typeof fetch{
 const host=new URL(apiOrigin);if(host.protocol!=='https:'||host.pathname!=='/'||host.username||host.password||host.search||host.hash)throw Error('Use an HTTPS API origin.');
 return async(input,init)=>{
  if(typeof input!=='string'||!input.startsWith('/api/'))return request(input,init);
  const url=new URL(input,host);if(url.origin!==host.origin||!url.pathname.startsWith('/api/'))throw Error('Invalid API destination.');
  const headers=new Headers(init?.headers);headers.delete('authorization');const token=await getToken();if(token)headers.set('Authorization',`Bearer ${token}`);
  return request(url.toString(),{...init,headers,credentials:'omit',redirect:'error'});
 };
}
