import {Browser} from '@capacitor/browser';
import type {AnchorHTMLAttributes} from 'react';
import {navigate} from './navigation';
export default function Link({href,onClick,...props}:AnchorHTMLAttributes<HTMLAnchorElement>&{href:string}){return <a {...props} href={href} onClick={event=>{onClick?.(event);if(!event.defaultPrevented&&href.startsWith('/')&&!href.startsWith('//')&&!props.target){event.preventDefault();if(['/privacy','/about'].includes(href))void Browser.open({url:'https://top1.fit'+href});else navigate(href);}}}/>;}
