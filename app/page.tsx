import Dashboard from '@/components/Dashboard';
import {appView} from '@/lib/appViews';

export default async function Home({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const params = await searchParams;
  const view = new URLSearchParams();
  if (typeof params.view === 'string') view.set('view', params.view);
  return <Dashboard initialView={appView(view)} initialMetric={typeof params.metric === 'string' ? params.metric : null}/>;
}
