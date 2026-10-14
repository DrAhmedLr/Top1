import type {MetadataRoute} from 'next';
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:'*',allow:['/','/about','/privacy'],disallow:['/api/','/share/','/auth/','/account/','/sign-in','/reset-password']},sitemap:'https://top1.fit/sitemap.xml'};}
