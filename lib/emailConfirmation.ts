import type {SupabaseClient} from '@supabase/supabase-js';
import {safeNextPath} from './profile';
import {normalizeLocale,localeDirection} from './i18n';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const validType=(type:string|null):type is 'email'|'signup'|'recovery'=>type==='email'||type==='signup'||type==='recovery';
function failure(url:URL,next:string,recovery=false){const target=new URL('/sign-in',url);target.searchParams.set('mode',recovery?'forgot-password':'sign-up');target.searchParams.set('error','confirmation');target.searchParams.set('next',safeNextPath(next));return new Response(null,{status:303,headers:{...headers,Location:target.toString()}});}
export function confirmationNext(raw:string|null,origin:string){
 if(raw?.startsWith('https://')){try{const callback=new URL(raw);return callback.origin===origin&&callback.pathname==='/auth/callback'?safeNextPath(callback.searchParams.get('next')):'/';}catch{return '/';}}
 return safeNextPath(raw);
}
/** Mail scanners and browser prefetches may GET links. Only an explicit form POST consumes the token. */
export function confirmationPage(url:URL,localeValue='en'){
 const locale=normalizeLocale(localeValue),l=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const hash=url.searchParams.get('token_hash'),type=url.searchParams.get('type'),next=confirmationNext(url.searchParams.get('next'),url.origin);
 if(!hash||hash.length>2048||!validType(type))return failure(url,next);
 const recovery=type==='recovery',title=recovery?l('Reset your password','Réinitialiser ton mot de passe','إعادة تعيين كلمة المرور'):l('Confirm your TOP1 email','Confirme ton adresse e-mail TOP1','تأكيد بريدك الإلكتروني في TOP1');
 return new Response(`<!doctype html><html lang="${locale}" dir="${localeDirection(locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · TOP1</title><style>body{margin:0;background:#080e14;color:#eef3f7;font:18px/1.6 system-ui;padding:24px}main{max-width:440px;margin:12vh auto;padding:28px;border:1px solid #263748;border-radius:20px;background:#101c29}button{font:inherit;border:0;border-radius:12px;background:#65ce93;color:#082818;padding:14px 24px;cursor:pointer;width:100%}a{color:#a7d9bc}h1{font-size:28px;line-height:1.2}</style></head><body><main><strong>TOP1</strong><h1>${title}</h1><p>${recovery?l('Continue to choose a new password.','Continue pour choisir un nouveau mot de passe.','تابع لاختيار كلمة مرور جديدة.'):l('Continue to confirm your email and open your account on this device.','Continue pour confirmer ton e-mail et ouvrir ton compte sur cet appareil.','تابع لتأكيد بريدك الإلكتروني وفتح حسابك على هذا الجهاز.')}</p><form method="post" action="/auth/confirm"><input type="hidden" name="token_hash" value="${escape(hash)}"><input type="hidden" name="type" value="${type}"><input type="hidden" name="next" value="${escape(next)}"><button type="submit">${recovery?l('Continue','Continuer','متابعة'):l('Confirm email','Confirmer mon e-mail','تأكيد البريد الإلكتروني')}</button></form><p><a href="/sign-in">${l('Back to sign in','Retour à la connexion','العودة إلى تسجيل الدخول')}</a></p></main></body></html>`,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
}
export async function confirmEmail(request:Request,auth:Pick<SupabaseClient['auth'],'verifyOtp'>|null){
 const url=new URL(request.url);
 if(request.headers.get('origin')!==url.origin)return new Response('Invalid origin.',{status:403,headers});
 let next='/',recovery=false;
 try{
  const body=await request.text();if(body.length>8192)return failure(url,next);
  const input=new URLSearchParams(body),hash=input.get('token_hash'),type=input.get('type');next=safeNextPath(input.get('next'));recovery=type==='recovery';
  if(!hash||hash.length>2048||!validType(type)||!auth)return failure(url,next,recovery);
  const {error}=await auth.verifyOtp({token_hash:hash,type});if(error)return failure(url,next,recovery);
  const target=new URL(recovery?'/reset-password':next,url);if(!recovery)target.searchParams.set('confirmed','1');
  return new Response(null,{status:303,headers:{...headers,Location:target.toString()}});
 }catch{return failure(url,next,recovery);}
}
