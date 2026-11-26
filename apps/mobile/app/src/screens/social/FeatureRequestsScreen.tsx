import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../api/trpc';
import {
  AppButton,
  AppCard,
  AppInput,
  AppText,
  ScreenContainer,
  StackHeader,
  useAppAlert,
} from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';

/**
 * Community Feature Requests Board backed by persistent tRPC storage.
 */
export function FeatureRequestsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { showAlert } = useAppAlert();
  const utils = trpc.useUtils();

  const listQuery = trpc.gamification.listFeatureRequests.useQuery();
  const createMutation = trpc.gamification.createFeatureRequest.useMutation({
    onSuccess: () => {
      void utils.gamification.listFeatureRequests.invalidate();
      setTitle('');
      setDescription('');
      showAlert({ title: 'Request Submitted', message: 'Your idea is now saved on the TOP1% board.' });
    },
    onError: (err) => showAlert({ title: 'Could Not Submit', message: err.message }),
  });
  const voteMutation = trpc.gamification.toggleFeatureRequestVote.useMutation({
    onSuccess: () => {
      void utils.gamification.listFeatureRequests.invalidate();
    },
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const items = listQuery.data ?? [];

  const handleSubmit = () => {
    const cleanTitle = title.trim();
    if (cleanTitle.length < 3) {
      showAlert({ title: 'Title too short', message: 'Enter at least 3 characters for your idea.' });
      return;
    }
    createMutation.mutate({ title: cleanTitle, description: description.trim() });
  };

  const statusColor = (status: string) =>
    status === 'shipped' ? c.check : status === 'planned' ? c.constant : c.warning;

  return (
    <ScreenContainer scroll>
      <StackHeader
        title="Feature Requests"
        subtitle="Vote on the TOP1% mobile & scientific roadmap"
      />

      <AppCard style={{ gap: 10 }}>
        <AppText size="md" weight="black">
          Suggest a Feature
        </AppText>
        <AppInput
          placeholder="Short feature title (e.g. Garmin FIT import)"
          value={title}
          onChangeText={setTitle}
        />
        <AppInput
          placeholder="Why would this improve your training? (optional)"
          value={description}
          onChangeText={setDescription}
        />
        <AppButton
          label="Submit Request"
          loading={createMutation.isPending}
          onPress={handleSubmit}
          fullWidth
        />
      </AppCard>

      <View style={{ gap: 10 }}>
        {items.length === 0 ? (
          <AppCard>
            <AppText size="sm" tone="sub">
              {listQuery.isLoading
                ? 'Loading community roadmap...'
                : 'No feature requests yet. Be the first to propose an upgrade!'}
            </AppText>
          </AppCard>
        ) : (
          items.map((item) => {
            const badgeCol = statusColor(item.status);
            return (
              <AppCard key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Pressable
                  onPress={() => voteMutation.mutate({ requestId: item.id })}
                  style={{
                    width: 50,
                    paddingVertical: 8,
                    borderRadius: RADII.input,
                    alignItems: 'center',
                    backgroundColor: item.votedByMe ? hexToRgba(c.constant, 0.22) : c.thirdBg,
                    borderWidth: 1,
                    borderColor: item.votedByMe ? c.constant : 'transparent',
                  }}
                >
                  <Ionicons
                    name="caret-up"
                    size={18}
                    color={item.votedByMe ? c.constant : c.subText}
                  />
                  <AppText size="sm" weight="black" tone={item.votedByMe ? 'constant' : 'default'}>
                    {item.votesCount}
                  </AppText>
                </Pressable>

                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <AppText size="sm" weight="black">
                      {item.title}
                    </AppText>
                    <View
                      style={{
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        borderRadius: RADII.pill,
                        backgroundColor: hexToRgba(badgeCol, 0.2),
                      }}
                    >
                      <AppText size="xxsm" weight="black" style={{ color: badgeCol }}>
                        {item.status.toUpperCase()}
                      </AppText>
                    </View>
                  </View>
                  {item.description ? (
                    <AppText size="xsm" tone="sub">
                      {item.description}
                    </AppText>
                  ) : null}
                </View>
              </AppCard>
            );
          })
        )}
      </View>
    </ScreenContainer>
  );
}
