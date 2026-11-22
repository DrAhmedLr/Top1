import type {ImgHTMLAttributes} from 'react';
export default function Image({fill,priority,quality,...props}:ImgHTMLAttributes<HTMLImageElement>&{fill?:boolean;priority?:boolean;quality?:number}){return <img {...props} loading={priority?'eager':'lazy'} style={{...(fill?{position:'absolute',width:'100%',height:'100%',inset:0}:{}),...props.style}}/>;}
