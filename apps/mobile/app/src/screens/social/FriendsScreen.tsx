import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../api/trpc';
import {
  AppButton,
  AppCard,
  AppInput,
  AppModal,
  AppText,
  AvatarView,
  ScreenContainer,
  SegmentedControl,
  StackHeader,
  useAppAlert,
} from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import type { MainStackParamList } from '../../navigation/types';

export function FriendsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { showAlert } = useAppAlert();
  const utils = trpc.useUtils();
  const user = useAuthStore((s) => s.user);

  const [tab, setTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [search, setSearch] = useState('');
  const [qrOpen, setQrOpen] = useState(false);

  const friendsQuery = trpc.friends.list.useQuery();
  const requestsQuery = trpc.friends.listRequests.useQuery();
  const searchQuery = trpc.friends.searchUsers.useQuery({ query: search });

  const sendReq = trpc.friends.sendRequest.useMutation({
    onSuccess: () => {
      utils.friends.listRequests.invalidate();
      showAlert({ title: 'Request Sent', message: 'Friend request delivered!' });
    },
  });

  const acceptReq = trpc.friends.acceptRequest.useMutation({
    onSuccess: () => {
      utils.friends.list.invalidate();
      utils.friends.listRequests.invalidate();
    },
  });

  const nudge = trpc.friends.nudgeSlacking.useMutation({
    onSuccess: () => showAlert({ title: 'Nudge Sent!', message: 'We reminded your friend to hit the gym.' }),
  });

  const friends = friendsQuery.data ?? [];
  const incoming = requestsQuery.data?.incoming ?? [];
  const outgoing = requestsQuery.data?.outgoing ?? [];

  return (
    <ScreenContainer scroll>
      <StackHeader
        title="Friends & Crew"
        subtitle={`${friends.length} gym partners`}
        right={
          <Pressable
            onPress={() => setQrOpen(true)}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: c.secondBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="qr-code-outline" size={20} color={c.constant} />
          </Pressable>
        }
      />

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { label: `Friends (${friends.length})`, value: 'friends' },
          { label: `Requests (${incoming.length})`, value: 'requests' },
          { label: 'Find', value: 'search' },
        ]}
      />

      {tab === 'friends' ? (
        <View style={{ gap: 10 }}>
          {friends.map((f) => (
            <AppCard
              key={f.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}
            >
              <Pressable
                onPress={() => navigation.navigate('PublicProfile', { userIdOrUsername: f.id })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}
              >
                <AvatarView config={f.avatarConfig} size={46} />
                <View style={{ flex: 1 }}>
                  <AppText size="sm" weight="bold">
                    {f.displayName}
                  </AppText>
                  <AppText size="xsm" tone="sub">
                    @{f.username} • {f.peakAverageRank} • {f.streaks}d 🔥
                  </AppText>
                </View>
              </Pressable>

              {f.isSlacking ? (
                <AppButton
                  label="Nudge"
                  size="sm"
                  variant="secondary"
                  onPress={() => nudge.mutate({ friendId: f.id })}
                />
              ) : (
                <AppText size="xsm" weight="bold" tone="check">
                  Active
                </AppText>
              )}
            </AppCard>
          ))}
        </View>
      ) : null}

      {tab === 'requests' ? (
        <View style={{ gap: 12 }}>
          <AppText size="sm" weight="bold" tone="sub">
            INCOMING ({incoming.length})
          </AppText>
          {incoming.length === 0 ? (
            <AppCard>
              <AppText size="sm" tone="sub">
                No incoming requests right now.
              </AppText>
            </AppCard>
          ) : (
            incoming.map((r) => (
              <AppCard key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <AvatarView config={r.user?.avatarConfig} size={42} />
                <View style={{ flex: 1 }}>
                  <AppText size="sm" weight="bold">
                    {r.user?.displayName ?? 'Athlete'}
                  </AppText>
                  <AppText size="xsm" tone="sub">
                    @{r.user?.username}
                  </AppText>
                </View>
                <AppButton
                  label="Accept"
                  size="sm"
                  onPress={() => acceptReq.mutate({ requestId: r.id })}
                />
              </AppCard>
            ))
          )}

          <AppText size="sm" weight="bold" tone="sub">
            SENT ({outgoing.length})
          </AppText>
          {outgoing.map((r) => (
            <AppCard key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <AvatarView config={r.user?.avatarConfig} size={40} />
              <View style={{ flex: 1 }}>
                <AppText size="sm" weight="bold">
                  {r.user?.displayName ?? 'Athlete'}
                </AppText>
                <AppText size="xsm" tone="sub">
                  Pending
                </AppText>
              </View>
            </AppCard>
          ))}
        </View>
      ) : null}

      {tab === 'search' ? (
        <View style={{ gap: 10 }}>
          <AppInput
            placeholder="Search by username or display name..."
            value={search}
            onChangeText={setSearch}
          />
          {(searchQuery.data ?? []).map((u) => (
            <AppCard
              key={u.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}
            >
              <Pressable
                onPress={() => navigation.navigate('PublicProfile', { userIdOrUsername: u.id })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
              >
                <AvatarView config={u.avatarConfig} size={42} />
                <View style={{ flex: 1 }}>
                  <AppText size="sm" weight="bold">
                    {u.displayName}
                  </AppText>
                  <AppText size="xsm" tone="sub">
                    @{u.username} • {u.peakAverageRank}
                  </AppText>
                </View>
              </Pressable>
              {u.isFriend ? (
                <AppText size="xsm" weight="bold" tone="check">
                  Friends
                </AppText>
              ) : (
                <AppButton
                  label="Add"
                  size="sm"
                  onPress={() => sendReq.mutate({ targetUserId: u.id })}
                />
              )}
            </AppCard>
          ))}
        </View>
      ) : null}

      {/* Share Handle / QR Modal */}
      <AppModal
        visible={qrOpen}
        onClose={() => setQrOpen(false)}
        title="Share Your Athlete Pass"
        subtitle="Friends can look you up by handle or referral code"
      >
        <View
          style={{
            alignItems: 'center',
            gap: 10,
            padding: 20,
            borderRadius: RADII.card,
            backgroundColor: hexToRgba(c.constant, 0.12),
            borderWidth: 1,
            borderColor: c.constant,
          }}
        >
          <Ionicons name="qr-code" size={110} color={c.text} />
          <AppText size="lg" weight="black">
            @{user?.username}
          </AppText>
          <AppText size="sm" weight="bold" tone="constant">
            Code: {user?.referralCode ?? 'APEX-LIFT'}
          </AppText>
          <AppText size="xsm" tone="sub">
            apexlift.app/u/{user?.username}
          </AppText>
        </View>
        <AppButton label="Done" onPress={() => setQrOpen(false)} fullWidth />
      </AppModal>
    </ScreenContainer>
  );
}
