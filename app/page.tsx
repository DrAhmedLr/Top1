import {headers} from 'next/headers';
import {regionalCalendar} from '@/lib/regionalCalendar';
import Dashboard from '@/components/Dashboard';
import {appView} from '@/lib/appViews';

export default async function Home({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const params = await searchParams;
  const view = new URLSearchParams();
  if (typeof params.view === 'string') view.set('view', params.view);
  const calendar = regionalCalendar(await headers(), process.env.VERCEL === '1');
  return <Dashboard initialCalendar={calendar} initialView={appView(view)} initialMetric={typeof params.metric === 'string' ? params.metric : null}/>;
}
