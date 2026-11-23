import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {ArrowLeft,ArrowUpRight,SlidersHorizontal,ChartNoAxesCombined,Target,UsersRound} from 'lucide-react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {CustomerDirectory as Directory,CustomerJourney} from '@/lib/customerJourneyTypes';
import type {AdminGoalReport} from '@/lib/adminGoalReport';
import AlgorithmExplorer from './AlgorithmExplorer';
import CustomerDirectory from './CustomerDirectory';
import CustomerTimeline from './CustomerTimeline';
import GoalOutcomes from './GoalOutcomes';
import UsageReport, {type UsageReportData} from './UsageReport';
import {getOperator} from './access';
import s from './page.module.css';

export const dynamic = 'force-dynamic';
export const metadata = {title:'Admin · TOP1',robots:{index:false,follow:false},referrer:'no-referrer' as const};

const tabs = [
  {id:'customers',title:'Customers',icon:UsersRound,description:'Find a customer and review their shared sessions, screens and actions.'},
  {id:'goals',title:'Goal outcomes',icon:Target,description:'Review shared goals by deadline, training adherence and forecast accuracy.'},
  {id:'algorithms',title:'Algorithms',icon:SlidersHorizontal,description:'Explore the thresholds behind a result and how a programme learns from training.'},
  {id:'usage',title:'Usage analytics',icon:ChartNoAxesCombined,description:'Explore daily activity and feature adoption across accounts that share usage counts.'},
] as const;
type Tab = typeof tabs[number]['id'];
type ReportProps = {client:SupabaseClient;owner:string;tab:Tab;days:number;customer:string|undefined};
function viewUrl(tab:Tab, days:number, customer?:string) {
  const params = new URLSearchParams({tab});
  if(tab!=='algorithms') params.set('days',String(days));
  if (tab==='customers' && customer) params.set('customer',customer);
  return '/admin?'+params.toString();
}

function ReportError({name}:{name:string}) {
  return <section className={s.panel} role="alert"><h2>{name} unavailable</h2><p>Reload to try fetching this report again.</p></section>;
}

async function Report({client,owner,tab,days,customer}:ReportProps) {
  if (tab==='algorithms') return <AlgorithmExplorer/>;
  if (tab==='goals') {
    const {data,error} = await client.rpc('admin_goal_report',{p_days:days});
    if (error?.code==='42501') notFound();
    return error||!data?<ReportError name="Goal report"/>:<GoalOutcomes report={data as AdminGoalReport}/>;
  }
  if (tab==='usage') {
    const {data,error} = await client.rpc('usage_report',{p_days:days});
    if (error?.code==='42501') notFound();
    return error||!data?<ReportError name="Usage analytics"/>:<UsageReport report={data as UsageReportData} owner={owner}/>;
  }
  if (customer) {
    const {data,error} = await client.rpc('admin_customer_journey',{p_customer:customer,p_days:days,p_before:null});
    if (error?.code==='42501') notFound();
    if (error) return <ReportError name="Customer journey"/>;
    if (!data) return <section className={s.panel}><h2>Customer not found</h2><p>This account is no longer available in the directory.</p></section>;
    return <CustomerTimeline key={customer+':'+days} initial={data as CustomerJourney} days={days}/>;
  }
  const {data,error} = await client.rpc('admin_customer_directory',{p_days:days,p_search:'',p_after:null});
  if (error?.code==='42501') notFound();
  return error||!data?<ReportError name="Customer directory"/>:<CustomerDirectory key={days} initial={data as Directory} days={days}/>;
}

export default async function AdminPage({searchParams}:{searchParams:Promise<{tab?:string;days?:string;customer?:string}>}) {
  const [params,access] = await Promise.all([searchParams,getOperator()]);
  if (access.state==='signed-out') {
    const tab=tabs.find(tab=>tab.id===params.tab);
    const next=tab?'/admin?tab='+tab.id:'/admin';
    redirect('/sign-in?next='+encodeURIComponent(next));
  }
  if (access.state==='denied') notFound();
  if (access.state==='unavailable') return <main className={s.page} dir="ltr" lang="en"><h1>Admin unavailable</h1><p>Reload to reconnect to the admin panel.</p></main>;
  const active = tabs.find(tab=>tab.id===params.tab)??tabs[0];
  const days = params.days==='7'?7:params.days==='90'?90:30;
  const customer = active.id==='customers'?params.customer:undefined;
  if (customer && !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(customer)) notFound();
  return <main className={s.page} dir="ltr" lang="en" id="main-content">
    <header className={s.top}><div className={s.brand}><b>TOP<span>1</span></b><i aria-hidden="true"/><span>Admin</span></div>
      <Link href="/" className={s.appLink}>Back to app <ArrowUpRight size={15}/></Link>
    </header>
    <nav aria-label="Admin sections" className={s.tabs}>{tabs.map(({id,title,icon:Icon})=><Link key={id} href={viewUrl(id,days)} prefetch={false} aria-current={id===active.id?'page':undefined}>
      <Icon size={16} aria-hidden="true"/>{title}
    </Link>)}</nav>
    {customer&&<Link href={viewUrl('customers',days)} className={s.back} prefetch={false}><ArrowLeft size={15}/>Customer directory</Link>}
    <div className={s.head}><div><h1>{customer?'Customer journey':active.title}</h1><p>{customer?'Activity shared by this account during the selected period.':active.description}</p></div>
      {active.id!=='algorithms'&&<nav aria-label="Reporting period" className={s.period}>{[7,30,90].map(d=><Link prefetch={false} key={d} href={viewUrl(active.id,d,customer)} aria-current={d===days?'page':undefined}>{d} days</Link>)}</nav>}
    </div>
    <Report client={access.client} owner={access.owner} tab={active.id} days={days} customer={customer}/>
  </main>;
}
