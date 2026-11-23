import {metrics} from '@/lib/registry';
import type {JourneyAction} from '@/lib/analyticsVocabulary';

const metricNames = new Map(metrics.map(metric => [metric.id, metric.name]));
const screenNames: Record<string, string> = {
  overview: 'Home', journey: 'First session', measurements: 'Measurements', progress: 'History',
  program: 'Programme', ranking: 'Ranking', scenarios: 'Scenarios',
  'sign-in': 'Sign in', 'sign-up': 'Sign up', 'forgot-password': 'Forgot password',
  'account-password': 'Account password', 'reset-password':'Reset password',
};

export function label(value: string) {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/^./, first => first.toUpperCase());
}
const actionNames:Record<JourneyAction,string> = {
  app_viewed:'Opened screen', journey_recommendation_shown:'Viewed recommendation', journey_basics_started:'Started baseline setup',
  journey_basics_saved:'Saved baseline', journey_recommendation_skipped:'Skipped recommendation', game_quest_started:'Started quest',
  game_checkin_completed:'Completed check-in', game_reward_earned:'Earned reward', game_library_opened:'Opened library',
  onboarding_started:'Started onboarding', onboarding_completed:'Finished onboarding', journey_started:'Started first session',
  journey_result_saved:'Saved first-session result', journey_reveal_viewed:'Viewed first-session result', journey_challenge_chosen:'Chose a challenge',
  journey_retest_completed:'Completed a retest', signup_requested:'Requested signup', signup_confirmed:'Confirmed signup',
  login_succeeded:'Signed in', recovery_requested:'Requested account recovery', measurement_saved:'Saved measurement',
  measurement_cleared:'Cleared measurement', profile_migrated:'Imported local profile', public_link_shared:'Shared profile link',
  simulator_used:'Used simulator', quick_log_opened:'Opened quick log', goal_saved:'Saved goal', workout_logged:'Logged workout',
  goal_selected:'Selected goal', workout_skipped:'Skipped workout', goal_retest_opened:'Opened goal retest',
  goal_save_failed:'Goal save failed', workout_save_failed:'Workout save failed',
};
export function actionName(id:string) { return Object.hasOwn(actionNames,id)?actionNames[id as JourneyAction]:label(id); }
export function metricName(id: string) { return metricNames.get(id) ?? label(id); }
export function screenName(id: string) { return screenNames[id] ?? label(id); }

const countFormat = new Intl.NumberFormat('en');
const shortDateFormat = new Intl.DateTimeFormat('en', {month:'short',day:'numeric',timeZone:'UTC'});
const instantFormat = new Intl.DateTimeFormat('en', {month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit',hourCycle:'h23',timeZone:'UTC'});

export function count(value:number) { return countFormat.format(value); }
export function dateOnly(value:string) { return shortDateFormat.format(new Date(value)); }
export function timestamp(value:string) { return instantFormat.format(new Date(value)); }
export function duration(seconds:number) {
  const value = Math.max(0, Math.floor(seconds));
  if (value < 60) return value + 's';
  const minutes = Math.floor(value / 60);
  if (minutes < 60) return minutes + 'm ' + value % 60 + 's';
  return Math.floor(minutes / 60) + 'h ' + minutes % 60 + 'm';
}
