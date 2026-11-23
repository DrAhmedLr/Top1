import type {SupabaseClient} from '@supabase/supabase-js';
import {safeNextPath} from './profile';
import {authErrorMessage,MIN_PASSWORD_LENGTH,PASSWORD_LENGTH_HINT,validatePassword} from './emailAuth';
import {normalizeLocale,localeDirection,translate,type Locale} from './i18n';

const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const validType=(type:string|null):type is 'email'|'signup'|'recovery'=>type==='email'||type==='signup'||type==='recovery';
type ConfirmationAuth=Pick<SupabaseClient['auth'],'verifyOtp'|'updateUser'|'signOut'>;

export function confirmationFailure(url:URL,next:string,recovery=false){
 const target=new URL('/sign-in',url);
 target.searchParams.set('mode',recovery?'forgot-password':'sign-up');
 target.searchParams.set('error','confirmation');
 target.searchParams.set('next',recovery?'/':safeNextPath(next));
 return new Response(null,{status:303,headers:{...headers,Location:target.toString()}});
}

export function confirmationNext(raw:string|null,origin:string){
 if(raw?.startsWith('https://')){try{const callback=new URL(raw);return callback.origin===origin&&callback.pathname==='/auth/callback'?safeNextPath(callback.searchParams.get('next')):'/';}catch{return '/';}}
 return safeNextPath(raw);
}

function page(locale:Locale,title:string,content:string,status=200) {
 const html=`<!doctype html><html lang="${locale}" dir="${localeDirection(locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · TOP1</title><style>
 body{margin:0;background:#101723;color:#eef3f7;font:16px/1.55 system-ui;padding:20px}main{box-sizing:border-box;width:min(100%,440px);margin:7vh auto;padding:24px;border:1px solid #334559;border-radius:16px;background:#172332}form,label{display:grid;gap:8px}form{gap:16px}input,button{box-sizing:border-box;font:inherit;min-width:0;min-height:44px;border-radius:9px;padding:9px 12px}input{border:1px solid #56677a;color:#fff;background:#101723}button{border:0;background:#a7d2ff;color:#102236;cursor:pointer;width:100%}a{color:#a7d2ff}h1{font-size:26px;line-height:1.2}[role=alert]{color:#ffc2ba}
 </style></head><body><main><strong>TOP1</strong><h1>${escape(title)}</h1>${content}</main></body></html>`;
 // Browsers send Origin: null on form POSTs from a no-referrer page. Send
 // only the origin so the POST can be checked without leaking the email URL.
 return new Response(html,{status,headers:{...headers,'Referrer-Policy':'strict-origin','Content-Type':'text/html; charset=utf-8'}});
}

function form(hash:string,type:'email'|'signup'|'recovery',next:string,locale:Locale,validationError='') {
 const l=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const recovery=type==='recovery';
 const title=recovery?translate(locale,'Set a new password.'):l('Confirm your TOP1 email','Confirme ton adresse e-mail TOP1','تأكيد بريدك الإلكتروني في TOP1');
 const instructions=recovery?translate(locale,'Choose a new password. After saving it, you’ll sign in again.'):l('Continue to confirm your email and open your account on this device.','Continue pour confirmer ton e-mail et ouvrir ton compte sur cet appareil.','تابع لتأكيد بريدك الإلكتروني وفتح حسابك على هذا الجهاز.');
 const fields=recovery?`<label>${translate(locale,'New password')}<input name="password" type="password" required minlength="${MIN_PASSWORD_LENGTH}" maxlength="128" autocomplete="new-password"></label>
 <small>${translate(locale,PASSWORD_LENGTH_HINT)}</small>
 <label>${translate(locale,'Confirm new password')}<input name="confirmation" type="password" required minlength="${MIN_PASSWORD_LENGTH}" maxlength="128" autocomplete="new-password"></label>`:'';
 return page(locale,title,`<p>${instructions}</p>
 ${validationError?`<p role="alert">${escape(translate(locale,validationError))}</p>`:''}
 <form method="post" action="/auth/confirm"><input type="hidden" name="token_hash" value="${escape(hash)}"><input type="hidden" name="type" value="${type}"><input type="hidden" name="next" value="${escape(next)}">
 ${fields}<button type="submit">${recovery?translate(locale,'Update password'):l('Confirm email','Confirmer mon e-mail','تأكيد البريد الإلكتروني')}</button></form>
 <p><a href="/sign-in">${l('Back to sign in','Retour à la connexion','العودة إلى تسجيل الدخول')}</a></p>`,validationError?422:200);
}

/** Mail scanners and browser prefetches may GET links. Only an explicit form POST consumes a token. */
export function confirmationPage(url:URL,localeValue='en'){
 const hash=url.searchParams.get('token_hash'),type=url.searchParams.get('type'),next=confirmationNext(url.searchParams.get('next'),url.origin);
 if(!hash||hash.length>2048||!validType(type))return confirmationFailure(url,next,type==='recovery');
 return form(hash,type,next,normalizeLocale(localeValue));
}

export async function confirmEmail(request:Request,auth:ConfirmationAuth|null,locale:Locale='en'){
 const url=new URL(request.url);
 if(request.headers.get('origin')!==url.origin)return new Response('Invalid origin.',{status:403,headers});
 let next='/',recovery=false;
 try{
  const body=await request.text();if(body.length>8192)return confirmationFailure(url,next);
  const input=new URLSearchParams(body),hash=input.get('token_hash'),type=input.get('type');
  next=safeNextPath(input.get('next'));recovery=type==='recovery';
  if(!hash||hash.length>2048||!validType(type)||!auth)return confirmationFailure(url,next,recovery);
  const password=input.get('password')??'';
  if(type==='recovery'){
   // Accept tabs opened on the previous confirmation screen without consuming their link.
   if(!input.has('password'))return form(hash,type,next,locale);
   try{validatePassword(password,input.get('confirmation')??'');}
   catch(error){return form(hash,type,next,locale,error instanceof Error?error.message:'Check your password.');}
  }
  const verified=await auth.verifyOtp({token_hash:hash,type});
  if(verified.error||!verified.data?.session||!verified.data.user)return confirmationFailure(url,next,recovery);
  if(type==='recovery'){
   // Some provider versions label a successful token-hash exchange as OTP.
   // Use the freshly verified recovery session here while its purpose is known.
   const changed=await auth.updateUser({password}).catch(()=>null);
   if(!changed||changed.error||changed.data?.user?.id!==verified.data.user.id){
    await auth.signOut({scope:'local'}).catch(()=>null);
    const reason=changed?.error?.code;
    if(reason==='weak_password'||reason==='same_password'){
     const requestLink=translate(locale,'Send a new reset link');
     return page(locale,translate(locale,'Set a new password.'),`<p role="alert">${escape(translate(locale,authErrorMessage(changed?.error)))}</p><a href="/sign-in?mode=forgot-password">${escape(requestLink)}</a>`,422);
    }
    return confirmationFailure(url,next,true);
   }
   const signedOut=await auth.signOut({scope:'global'}).catch(()=>({error:true}));
   if(signedOut.error){
    const notice=translate(locale,'Your password was updated, but we could not sign out all sessions. Sign out from your account before signing in again.');
    return page(locale,translate(locale,'Update password'),`<p role="status">${escape(notice)}</p><a href="/?view=settings">${translate(locale,'Settings')}</a>`);
   }
   return new Response(null,{status:303,headers:{...headers,Location:new URL('/sign-in?passwordUpdated=1',url).toString()}});
  }
  const target=new URL(next,url);target.searchParams.set('confirmed','1');
  return new Response(null,{status:303,headers:{...headers,Location:target.toString()}});
 }catch{return confirmationFailure(url,next,recovery);}
}
