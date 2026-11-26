import { router } from '../trpc.js';
import { authRouter } from './auth.js';
import { coachRouter } from './coach.js';
import { exerciseRouter } from './exercise.js';
import { foodRouter } from './food.js';
import { friendsRouter } from './friends.js';
import { gamificationRouter } from './gamification.js';
import { healthRouter } from './health.js';
import { leaderboardRouter } from './leaderboard.js';
import { notificationsRouter } from './notifications.js';
import { physiologyRouter } from './physiology.js';
import { postRouter } from './post.js';
import { postInteractionsRouter } from './postInteractions.js';
import { presetRouter } from './preset.js';
import { rankRouter } from './rank.js';
import { shopRouter } from './shop.js';
import { top1Router } from './top1.js';
import { userRouter } from './user.js';
import { wearableRouter } from './wearable.js';
import { workoutGenerationRouter } from './workoutGeneration.js';
import { workoutScheduleRouter } from './workoutSchedule.js';

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  user: userRouter,
  top1: top1Router,
  coach: coachRouter,
  physiology: physiologyRouter,
  wearable: wearableRouter,
  rank: rankRouter,
  exercise: exerciseRouter,
  preset: presetRouter,
  post: postRouter,
  postInteractions: postInteractionsRouter,
  workoutSchedule: workoutScheduleRouter,
  workoutGeneration: workoutGenerationRouter,
  gamification: gamificationRouter,
  food: foodRouter,
  friends: friendsRouter,
  leaderboard: leaderboardRouter,
  shop: shopRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;
