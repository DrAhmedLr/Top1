/** Capacitor's local origins. These requests must use bearer auth, never web cookies. */
export const NATIVE_ORIGINS=['capacitor://localhost','https://localhost'] as const;
export const nativeOrigin=(value:string|null)=>!!value&&NATIVE_ORIGINS.includes(value as typeof NATIVE_ORIGINS[number]);
export const usesBearerAuth=(headers:Headers)=>nativeOrigin(headers.get('origin'))||headers.has('authorization');
export function bearerToken(headers:Headers){const match=/^Bearer ([A-Za-z0-9._~-]+)$/.exec(headers.get('authorization')??'');return match?.[1]??null;}
export function validApiOrigin(request:Request){
 const origin=request.headers.get('origin');
 return origin===new URL(request.url).origin||nativeOrigin(origin)&&!!bearerToken(request.headers);
}
export function nativeCorsHeaders(origin:string|null){
 if(!nativeOrigin(origin))return null;
 return {'Access-Control-Allow-Origin':origin!,'Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, X-Profile-User','Access-Control-Max-Age':'600','Cache-Control':'private, no-store','Vary':'Origin'};
}
