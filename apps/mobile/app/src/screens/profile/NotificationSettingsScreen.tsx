import React from 'react';
import { Pressable, Switch, View } from 'react-native';
import { trpc } from '../../api/trpc';
import { AppCard, AppText, ScreenContainer, StackHeader } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIMES = ['07:00', '12:00', '17:30', '18:00', '19:30'];

export function NotificationSettingsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const utils = trpc.useUtils();

  const settingsQuery = trpc.notifications.getSettings.useQuery();
  const update = trpc.notifications.updateSettings.useMutation({
    onSuccess: () => utils.notifications.getSettings.invalidate(),
  });

  const s = settingsQuery.data;

  const ToggleRow = ({
    label,
    desc,
    value,
    onValueChange,
  }: {
    label: string;
    desc: string;
    value: boolean;
    onValueChange: (v: boolean) => void;
  }) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 6,
      }}
    >
      <View style={{ flex: 1 }}>
        <AppText size="sm" weight="bold">
          {label}
        </AppText>
        <AppText size="xsm" tone="sub">
          {desc}
        </AppText>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: c.thirdBg, true: hexToRgba(c.constant, 0.5) }}
        thumbColor={value ? c.constant : c.subText}
      />
    </View>
  );

  const toggleWeekday = (dayIdx: number) => {
    if (!s) return;
    const exists = s.reminderWeekdays.includes(dayIdx);
    const next = exists
      ? s.reminderWeekdays.filter((d) => d !== dayIdx)
      : [...s.reminderWeekdays, dayIdx].sort((a, b) => a - b);
    update.mutate({ reminderWeekdays: next });
  };

  return (
    <ScreenContainer scroll>
      <StackHeader
        title="Notification Settings"
        subtitle="Manage workout reminders, social alerts & updates"
      />

      {s ? (
        <>
          {/* Category 1: Reminders */}
          <AppCard style={{ gap: 12 }}>
            <AppText size="xsm" weight="black" tone="constant">
              REMINDERS
            </AppText>
            <ToggleRow
              label="Workout Reminders"
              desc="Scheduled push nudges on your training days"
              value={s.reminder}
              onValueChange={(reminder) => update.mutate({ reminder })}
            />
            <ToggleRow
              label="Weekly Progress Digest"
              desc="Summary of rank gains, volume & streak"
              value={s.progress}
              onValueChange={(progress) => update.mutate({ progress })}
            />

            <View style={{ gap: 6 }}>
              <AppText size="xsm" weight="bold" tone="sub">
                REMINDER DAYS
              </AppText>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }}>
                {WEEKDAYS.map((day, idx) => {
                  const active = s.reminderWeekdays.includes(idx);
                  return (
                    <Pressable
                      key={day}
                      onPress={() => toggleWeekday(idx)}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 10,
                        alignItems: 'center',
                        backgroundColor: active ? hexToRgba(c.constant, 0.22) : c.thirdBg,
                        borderWidth: 1,
                        borderColor: active ? c.constant : 'transparent',
                      }}
                    >
                      <AppText size="xsm" weight="bold" tone={active ? 'constant' : 'sub'}>
                        {day}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <AppText size="xsm" weight="bold" tone="sub">
                REMINDER TIME
              </AppText>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {TIMES.map((t) => {
                  const active = s.reminderTime === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => update.mutate({ reminderTime: t })}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: RADII.pill,
                        backgroundColor: active ? hexToRgba(c.constant, 0.22) : c.thirdBg,
                        borderWidth: 1,
                        borderColor: active ? c.constant : 'transparent',
                      }}
                    >
                      <AppText size="xsm" weight="bold" tone={active ? 'constant' : 'sub'}>
                        {t}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </AppCard>

          {/* Category 2: Community */}
          <AppCard style={{ gap: 8 }}>
            <AppText size="xsm" weight="black" tone="constant">
              COMMUNITY
            </AppText>
            <ToggleRow
              label="Friend Feed Activity"
              desc="When friends finish major PR sessions"
              value={s.feed}
              onValueChange={(feed) => update.mutate({ feed })}
            />
            <ToggleRow
              label="Comments"
              desc="Replies and comments on your workouts"
              value={s.comments}
              onValueChange={(comments) => update.mutate({ comments })}
            />
            <ToggleRow
              label="Reactions"
              desc="Emoji props dropped on your workout posts"
              value={s.reactions}
              onValueChange={(reactions) => update.mutate({ reactions })}
            />
            <ToggleRow
              label="Friend Requests"
              desc="New friend invitations and acceptances"
              value={s.friends}
              onValueChange={(friends) => update.mutate({ friends })}
            />
            <ToggleRow
              label="Slacking Nudges"
              desc="Allow gym partners to nudge you when inactive"
              value={s.slacking}
              onValueChange={(slacking) => update.mutate({ slacking })}
            />
            <ToggleRow
              label="Rank Challenges"
              desc="When a friend passes your exercise rank"
              value={s.rankChallenge}
              onValueChange={(rankChallenge) => update.mutate({ rankChallenge })}
            />
          </AppCard>

          {/* Category 3: Announcements */}
          <AppCard style={{ gap: 8 }}>
            <AppText size="xsm" weight="black" tone="constant">
              ANNOUNCEMENTS
            </AppText>
            <ToggleRow
              label="Product & Season Updates"
              desc="New league seasons, themes & feature launches"
              value={s.announcement}
              onValueChange={(announcement) => update.mutate({ announcement })}
            />
          </AppCard>
        </>
      ) : null}
    </ScreenContainer>
  );
}
