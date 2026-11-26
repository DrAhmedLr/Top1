import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../api/trpc';
import {
  AppButton,
  AppCard,
  AppText,
  ScreenContainer,
  StackHeader,
} from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba } from '../../theme/tokens';

export function NotificationCenterScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const utils = trpc.useUtils();

  const listQuery = trpc.notifications.list.useQuery();
  const markRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
  });

  const rows = listQuery.data?.notifications ?? [];
  const unread = listQuery.data?.unreadCount ?? 0;

  return (
    <ScreenContainer scroll>
      <StackHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'All caught up'}
        right={
          unread > 0 ? (
            <AppButton
              label="Mark Read"
              size="sm"
              variant="secondary"
              loading={markRead.isPending}
              onPress={() => markRead.mutate()}
            />
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <AppCard style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
          <Ionicons name="notifications-off-outline" size={32} color={c.subText} />
          <AppText size="md" weight="bold">
            No notifications yet
          </AppText>
          <AppText size="sm" tone="sub" align="center">
            Reactions, comments, friend requests & gym nudges will appear here.
          </AppText>
        </AppCard>
      ) : (
        <View style={{ gap: 8 }}>
          {rows.map((n) => (
            <AppCard
              key={n.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderColor: !n.readAt ? hexToRgba(c.constant, 0.55) : c.thirdBg,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 11,
                  backgroundColor: !n.readAt ? hexToRgba(c.constant, 0.18) : c.thirdBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={
                    n.type === 'reaction'
                      ? 'flame-outline'
                      : n.type === 'comment'
                        ? 'chatbubble-outline'
                        : n.type === 'friend_request'
                          ? 'person-add-outline'
                          : 'notifications-outline'
                  }
                  size={18}
                  color={!n.readAt ? c.constant : c.subText}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText size="sm" weight="bold">
                  {n.title}
                </AppText>
                <AppText size="xsm" tone="sub">
                  {n.body}
                </AppText>
              </View>
            </AppCard>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}
