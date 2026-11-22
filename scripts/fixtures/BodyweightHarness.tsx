'use client';
/** Local integration fixture. Never include the temporary route in a release. */
import {useEffect,useRef,useState} from 'react';
import BodyweightTracker from '@/components/BodyweightTracker';
import {useBodyweight} from '@/lib/hooks/useBodyweight';
import {appendWeight,weightPage,type WeightEvent} from '@/lib/bodyweight';

export default function BodyweightHarness(){
 const [owner,setOwner]=useState('qa-owner-a'),[ready,setReady]=useState(false),[network,setNetwork]=useState<'online'|'offline'|'lost-response'>('online'),[count,setCount]=useState(0);
 const server=useRef<Record<string,WeightEvent[]>>({}),serverOwner=useRef(owner),networkRef=useRef(network);serverOwner.current=owner;networkRef.current=network;
 useEffect(()=>{
  const original=window.fetch;
  try{server.current=JSON.parse(localStorage.getItem('qa-weight-server-v1')??'{}');}catch{}
  window.fetch=async(input,options)=>{
   if(!String(input).includes('/api/bodyweight'))return original(input,options);
   if(networkRef.current==='offline')throw new TypeError('Simulated offline network');
   const target=serverOwner.current;
   const response=(body:unknown,status=200)=>Promise.resolve(new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}}));
   if(options?.method==='POST'){
    const headers=options.headers as Record<string,string>;
    if(headers['X-Profile-User']!==serverOwner.current)return response({error:'Your account changed.'},409);
    try{
     const mutation=JSON.parse(String(options.body));
     const result=appendWeight(server.current[target]??[],mutation);
     server.current[target]=result.events;
     localStorage.setItem('qa-weight-server-v1',JSON.stringify(server.current));setCount(result.events.length);
     if(networkRef.current==='lost-response'){networkRef.current='offline';setNetwork('offline');throw new TypeError('Simulated response loss after commit');}
     return response({entry:result.event});
    }catch(error){
     if(error instanceof TypeError)throw error;
     return response({error:error instanceof Error?error.message:'Fixture error'},409);
    }
   }
   const url=new URL(String(input),location.origin),date=url.searchParams.get('before'),id=url.searchParams.get('id');
   return response({...weightPage(server.current[target]??[],date&&id?{date,id}:null,url.searchParams.get('deleted')==='1'),epoch:0});
  };
  setReady(true);return()=>{window.fetch=original;};
 },[]);
 const weights=useBodyweight(owner,ready);
 return <div className="app-shell glass-site personal-app"><div className="performance-shell performance-snapshot">
  <h1>Local bodyweight integration fixture</h1>
  <p>Fixture owner: {owner}</p><p>Server event count: {count}</p>
  <button onClick={()=>setOwner(value=>value==='qa-owner-a'?'qa-owner-b':'qa-owner-a')}>Switch fixture account</button>
  <button onClick={()=>setNetwork('online')}>Fixture online</button>
  <button onClick={()=>setNetwork('offline')}>Fixture offline</button>
  <button onClick={()=>setNetwork('lost-response')}>Lose next response after commit</button>
  <p>Fixture network: {network}</p>
  <BodyweightTracker state={weights} onSettings={()=>{}}/>
 </div></div>;
}
