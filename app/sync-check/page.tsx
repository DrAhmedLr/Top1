import {notFound} from 'next/navigation';
import Harness from '@/scripts/fixtures/WorkspaceHarness';
export default function Page(){if(process.env.NODE_ENV!=='development')notFound();return <Harness/>;}
