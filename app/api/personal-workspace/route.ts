import {getSupabaseServer} from '@/lib/supabaseServer';
import {personalWorkspaceHandlers} from '@/lib/personalWorkspaceApi';
export const dynamic='force-dynamic';
export const {GET,POST}=personalWorkspaceHandlers(getSupabaseServer);
