import SignInForm from '@/components/SignInForm';
import { authModeFromQuery } from '@/lib/emailAuth';
import { safeNextPath } from '@/lib/profile';

export default async function SignIn({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params=await searchParams;
  const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
  return <SignInForm initialMode={authModeFromQuery(first(params.mode)??null)} initialNext={safeNextPath(first(params.next)??null)}/>;
}
