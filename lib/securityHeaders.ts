export function contentSecurityPolicy(nonce:string,development=false){
 if(!/^[a-zA-Z0-9-]+$/.test(nonce))throw new Error('Invalid script nonce.');
 return [`default-src 'self'`,`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development?" 'unsafe-eval'":''}`,`style-src 'self' 'unsafe-inline'`,`img-src 'self' data: blob: https:`,`font-src 'self' data:`,`connect-src 'self' https://*.supabase.co https://*.posthog.com${development?' ws:':''}`,`object-src 'none'`,`base-uri 'self'`,`form-action 'self'`,`frame-ancestors 'none'`].join('; ');
}
