import {regionalCalendar} from '@/lib/regionalCalendar';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return Response.json(regionalCalendar(request.headers, process.env.VERCEL === '1'), {
    headers: {'Cache-Control': 'private, no-store'},
  });
}
