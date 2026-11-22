const base=process.env.TOP1_SMOKE_URL||'https://top1.fit';
for(const origin of ['capacitor://localhost','https://localhost']){
 const preflight=await fetch(new URL('/api/personal-workspace',base),{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type,x-profile-user'}});
 if(preflight.status!==204||preflight.headers.get('Access-Control-Allow-Origin')!==origin||preflight.headers.has('Access-Control-Allow-Credentials'))throw Error('Native preflight failed');
 for(const authorization of [null,'Bearer synthetic-invalid-token']){
  const headers={Origin:origin,...(authorization?{Authorization:authorization}:{})};const r=await fetch(new URL('/api/personal-workspace',base),{headers});if(r.status!==401||r.headers.get('Access-Control-Allow-Origin')!==origin)throw Error('Native auth boundary failed');
 }
 console.log(`${origin}: preflight and signed-out/invalid-token rejection passed`);
}
const denied=await fetch(new URL('/api/personal-workspace',base),{method:'POST',headers:{Origin:'https://evil.invalid',Authorization:'Bearer synthetic-invalid-token','Content-Type':'application/json'},body:'{}'});
if(denied.status!==403||denied.headers.has('Access-Control-Allow-Origin'))throw Error('Untrusted origin accepted');
console.log('Untrusted origin rejected without CORS permission.');
