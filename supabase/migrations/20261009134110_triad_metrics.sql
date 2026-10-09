begin;
-- Add supported ranges; retain both legacy IDs and every existing observation.
alter table public.metric_logs drop constraint metric_range;
alter table public.metric_logs add constraint metric_range check (case metric_id
 when 'apob' then metric_value between 1 and 300
 when 'lpa' then metric_value between 0.1 and 1000
 when 'fasting_insulin' then metric_value between 0.1 and 100
 when 'hscrp' then metric_value between 0.01 and 100
 when 'hba1c' then metric_value between 3 and 15
 when 'homocysteine' then metric_value between 1 and 100
 when 'cystatin_c' then metric_value between 0.1 and 10
 when 'ggt' then metric_value between 1 and 1000
 when 'vo2_max' then metric_value between 10 and 100
 when 'zone2_power' then metric_value between 0.1 and 8
 when 'pefr' then metric_value between 10 and 200
 when 'rhr' then metric_value between 25 and 150
 when 'hrv' then metric_value between 1 and 250
 when 'hrr_1min' then metric_value between 0 and 100
 when 'bp_systolic' then metric_value between 70 and 240
 when 'body_fat' then metric_value between 3 and 60
 when 'visceral_fat' then metric_value between 1 and 500
 when 'grip_strength' then metric_value between 1 and 120
 when 'cmj' then metric_value between 1 and 120
 when 'broad_jump' then metric_value between 0.1 and 4
 when 'squat_1rm' then metric_value between 0.1 and 4
 when 'deadlift_1rm' then metric_value between 0.1 and 5
 when 'bench_1rm' then metric_value between 0.1 and 3
 when 'pullup_1rm' then metric_value between 0 and 2
 when 'farmers_carry' then metric_value between 1 and 300
 when 'sit_to_stand' then metric_value between 1 and 60
 when 'ankle_dorsiflexion' then metric_value between 1 and 70
 when 'total_sleep' then metric_value between 120 and 900
 when 'sleep_efficiency' then metric_value between 30 and 100
 when 'circadian_regularity' then metric_value between 0 and 100
 when 'single_leg_balance' then metric_value between 0 and 180
 when 'reaction_time' then metric_value between 100 and 1000
 when 'waist_height_ratio' then metric_value between 0.2 and 1.5
 when 'fasting_glucose' then metric_value between 20 and 600
 when 'pushups' then metric_value between 0 and 150
 when 'sauna_minutes' then metric_value between 0 and 600
 when 'cold_plunge_minutes' then metric_value between 0 and 120
 when 'thermal_hrv_rebound' then metric_value between 0.01 and 10
 else false end);
commit;
