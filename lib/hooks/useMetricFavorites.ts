'use client';
import {useEffect,useRef,useState} from 'react';import {activeMetrics} from '../registry';
export function useMetricFavorites(owner:string){
 const current=useRef(owner);current.current=owner;
 const [state,setState]=useState<{owner:string;ids:string[]}>({owner,ids:[]}),[error,setError]=useState('');
 useEffect(()=>{setError('');try{const raw=JSON.parse(localStorage.getItem(`top1-favorites-${owner}`)??'[]');setState({owner,ids:Array.isArray(raw)?raw.filter(id=>typeof id==='string'&&activeMetrics.some(m=>m.id===id)):[]});}catch{setState({owner,ids:[]});setError('Favorites are available in memory only.');}},[owner]);
 const ids=state.owner===owner?state.ids:[];
 function toggle(id:string){if(current.current!==owner||!activeMetrics.some(m=>m.id===id))return;const next=ids.includes(id)?ids.filter(x=>x!==id):[...ids,id];setState({owner,ids:next});try{localStorage.setItem(`top1-favorites-${owner}`,JSON.stringify(next));}catch{setError('Favorites are available in memory only.');}}
 return {ids,toggle,error};
}
