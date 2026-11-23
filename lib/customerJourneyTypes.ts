export type Customer = {
  id: string;
  email: string | null;
  createdAt: string;
  sharing: boolean;
  consentedAt: string | null;
  lastSeen: string | null;
  eventCount: number;
  sessions: number;
  activeSeconds: number;
};
export type JourneyEvent = {
  seq: number;
  at: string;
  event: string;
  view: string;
  metric: string | null;
  seconds: number;
  sessionId: string;
  ip: string | null;
  ipSeenAt: string | null;
};
export type CustomerDirectory = {customers: Customer[]; nextAfter: string | null};
export type CustomerJourney = {
  customer: Customer;
  recentIp: {address: string; at: string} | null;
  screens: {view: string; seconds: number}[];
  events: JourneyEvent[];
  nextBefore: number | null;
};
