import {useSyncExternalStore} from 'react';
const subscribe=(fn:()=>void)=>{window.addEventListener('popstate',fn);return()=>window.removeEventListener('popstate',fn);};
const snapshot=()=>location.pathname+location.search;
export const useLocation=()=>useSyncExternalStore(subscribe,snapshot,snapshot);
export function navigate(href:string,replace=false){if(!href.startsWith('/')||href.startsWith('//'))throw Error('Invalid app destination.');history[replace?'replaceState':'pushState'](null,'',href);window.dispatchEvent(new PopStateEvent('popstate'));}
const router={push:(href:string)=>navigate(href),replace:(href:string)=>navigate(href,true),refresh:()=>window.dispatchEvent(new PopStateEvent('popstate')),back:()=>history.back()};
export function useRouter(){return router;}
export function useSearchParams(){return new URLSearchParams(useLocation().split('?')[1]??'');}
export function usePathname(){return useLocation().split('?')[0];}
