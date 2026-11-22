import {getTranslations} from '@/lib/localeServer';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {confirmationPage,confirmEmail} from '@/lib/emailConfirmation';
export const dynamic='force-dynamic';
export async function GET(request:Request){const {locale}=await getTranslations();return confirmationPage(new URL(request.url),locale);}
export async function POST(request:Request){
 const client=await getSupabaseServer();return confirmEmail(request,client?.auth??null);
}
