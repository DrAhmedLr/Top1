import 'server-only';
import {cookies,headers} from 'next/headers';
import {LOCALE_COOKIE,localePreference,requestDeviceLocale,translate} from './i18n';

export async function getTranslations() {
 const [cookieStore,requestHeaders] = await Promise.all([cookies(),headers()]);
 const preference = localePreference(cookieStore.get(LOCALE_COOKIE)?.value);
 const deviceLocale = requestDeviceLocale(requestHeaders.get('accept-language'));
 const locale = preference === 'device' ? deviceLocale : preference;
 return {locale, preference, t:(message:string|undefined|null)=>translate(locale,message)};
}
