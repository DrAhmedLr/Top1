import { publicProcedure, router } from '../trpc.js';

export const healthRouter = router({
  healthCheck: publicProcedure.query(() => {
    return {
      status: 'ok' as const,
      app: 'ApexLift API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }),
});
