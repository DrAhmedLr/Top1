import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkGoogleProvider} from './auth';
const config={url:'https://project.supabase.co',key:'public-test-key'};
test('enabled Google provider permits OAuth flow',async()=>{await checkGoogleProvider(config,async()=>Response.json({external:{google:true}}));});
test('disabled Google provider yields a useful message before redirect',async()=>{await assert.rejects(checkGoogleProvider(config,async()=>Response.json({external:{google:false}})),/local measurements are safe/);});
test('provider settings failures do not silently start OAuth',async()=>{await assert.rejects(checkGoogleProvider(config,async()=>new Response('',{status:503})),/temporarily unavailable/);});
