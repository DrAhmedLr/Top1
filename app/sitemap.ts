import type {MetadataRoute} from 'next';
export default function sitemap():MetadataRoute.Sitemap{return ['/','/about','/privacy'].map(path=>({url:`https://top1.fit${path}`,changeFrequency:'monthly' as const}));}
