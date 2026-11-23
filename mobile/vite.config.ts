import {defineConfig,loadEnv} from 'vite';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const here=fileURLToPath(new URL('.',import.meta.url)),root=resolve(here,'..');
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,root,'NEXT_PUBLIC_');
 // Explicit allowlist: server credentials can never be substituted into the bundle.
 if(mode==='production'){
  if(!env.NEXT_PUBLIC_SUPABASE_URL||!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)throw Error('Configure the public TOP1 Supabase URL and publishable key before building.');
  const key=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!key.startsWith('sb_publishable_')){let role='';try{role=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role;}catch{}if(role!=='anon')throw Error('Only a publishable or legacy anon key may be bundled.');}
 }
 const publicEnv={NEXT_PUBLIC_SUPABASE_URL:env.NEXT_PUBLIC_SUPABASE_URL??'',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??'',NEXT_PUBLIC_SITE_URL:'https://top1.fit',NEXT_PUBLIC_NATIVE_APP:'1'};
 return {esbuild:{jsx:"automatic"},root:here,publicDir:false,build:{outDir:'www',emptyOutDir:true,rollupOptions:{onwarn(warning,handler){if(warning.code==='MODULE_LEVEL_DIRECTIVE'&&warning.message.includes('use client'))return;handler(warning);}}},resolve:{dedupe:['react','react-dom'],alias:[{find:'@/lib/appNavigation',replacement:resolve(here,'src/platform/appNavigation.ts')},{find:'@/lib/supabaseClient',replacement:resolve(here,'src/platform/client.ts')},{find:/^\.\.\/supabaseClient$/,replacement:resolve(here,'src/platform/client.ts')},{find:'@/lib/emailAuth',replacement:resolve(here,'src/platform/emailAuth.ts')},{find:'next/navigation',replacement:resolve(here,'src/next/navigation.ts')},{find:'next/link',replacement:resolve(here,'src/next/link.tsx')},{find:'next/dynamic',replacement:resolve(here,'src/next/dynamic.tsx')},{find:'next/image',replacement:resolve(here,'src/next/image.tsx')},{find:'@',replacement:root}]},define:{...Object.fromEntries(Object.entries(publicEnv).map(([key,value])=>[`process.env.${key}`,JSON.stringify(value)])),'process.env.NODE_ENV':JSON.stringify(mode==='production'?'production':'development')},server:{fs:{allow:[root]}}};
});
