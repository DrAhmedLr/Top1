export const analyticsViews = ['journey','overview','ranking','program','measurements','progress','scenarios','profile','settings','methodology','labs','sign-in','sign-up','forgot-password','reset-password','account-password','share','privacy'] as const;
export type AnalyticsView = typeof analyticsViews[number];

export const analyticsEvents = ['journey_recommendation_shown','journey_basics_started','journey_basics_saved','journey_recommendation_skipped','game_quest_started','game_checkin_completed','game_reward_earned','game_library_opened','app_viewed','onboarding_started','onboarding_completed','journey_started','journey_result_saved','journey_reveal_viewed','journey_challenge_chosen','journey_retest_completed','signup_requested','signup_confirmed','login_succeeded','recovery_requested','measurement_saved','measurement_cleared','profile_migrated','public_link_shared','simulator_used','quick_log_opened','goal_saved','workout_logged'] as const;
export type AnalyticsEvent = typeof analyticsEvents[number];
export const journeyActions = [...analyticsEvents, 'goal_selected', 'workout_skipped', 'goal_retest_opened', 'goal_save_failed', 'workout_save_failed'] as const;
export type JourneyAction = typeof journeyActions[number];
