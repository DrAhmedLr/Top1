// ISO weekdays (Monday = 1) match Intl.Locale week information.
export type RegionalCalendar = {region: string; firstDay: number};

export function regionalCalendar(headers: Headers, onVercel: boolean): RegionalCalendar | null {
  if (!onVercel) return null;
  const region = headers.get('x-vercel-ip-country');
  if (!region || !/^[A-Z]{2}$/.test(region) || ['XX', 'ZZ'].includes(region)) return null;
  const locale = new Intl.Locale('und-' + region) as Intl.Locale & {
    getWeekInfo?: () => {firstDay: number};
    weekInfo?: {firstDay: number};
  };
  const info = locale.getWeekInfo?.() ?? locale.weekInfo;
  return info ? {region, firstDay: info.firstDay} : null;
}

export function calendarWeek(day: string, firstDay = 1) {
  const date = new Date(day + 'T12:00:00Z');
  const offset = (date.getUTCDay() - firstDay + 7) % 7;
  const start = date.getTime() - offset * 86400000;
  return Array.from({length: 7}, (_, index) => new Date(start + index * 86400000));
}
