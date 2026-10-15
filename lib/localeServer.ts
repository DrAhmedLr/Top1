import 'server-only';
import {cookies} from 'next/headers';
import {LOCALE_COOKIE,normalizeLocale,translate} from './i18n';
export async function getTranslations(){const locale=normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);return {locale,t:(message:string|undefined|null)=>translate(locale,message)};}
