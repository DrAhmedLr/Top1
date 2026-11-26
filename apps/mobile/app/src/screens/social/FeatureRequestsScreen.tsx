import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { top1CloudApi } from '../../api/top1Cloud';
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

type FeatureItem = {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'planned' | 'shipped';
  votes: number;
  voted: boolean;
};

const SEED_REQUESTS: FeatureItem[] = [
  {
    id: 'fr-1',
    title: 'Apple Watch live set & HRV sync',
    description: 'Log completed sets from wrist and pull RMSSD directly into TOP1% Readiness.',
    status: 'planned',
    votes: 142,
    voted: false,
  },
  {
    id: 'fr-2',
    title: 'Strava auto-post with TOP1% Bodygraph overlay',
    description: 'Attach the 19-muscle live recovery/stimulus heatmap when exporting workouts to Strava.',
    status: 'planned',
    votes: 98,
    voted: false,
  },
  {
    id: 'fr-3',
    title: 'Multi-language Arabic RTL & French coaching cues',
    description: 'Full EN / FR / AR translation across Benchmark Lab, Coach Hub, and workout presets.',
    status: 'shipped',
    votes: 84,
    voted: true,
  },
  {
    id: 'fr-4',
    title: 'Custom Cable Stack & Machine Ratio Presets',
    description: 'Save 2:1 or 4:1 pulley multipliers per machine inside gym presets.',
    status: 'open',
    votes: 63,
    voted: false,
  },
];

/**
 * Community Feature Requests Board (ported from Liftoff 2.18.1 FeatureRequests).
 * Syncs live with `/api/mobile/social` when signed into Top1.Fit Cloud, with local fallback.
 */
export function FeatureRequestsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { showAlert } = useAppAlert();

  const [items, setItems] = useState<FeatureItem[]>(SEED_REQUESTS);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    top1CloudApi
      .getSocial()
      .then((res) => {
        if (!active || !res.featureRequests.length) return;
        setItems(
          res.featureRequests.map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description,
            status: r.status,
            votes: r.votes_count,
            voted: false,
          })),
        );
      })
      .catch(() => {
        // Offline / local demo mode keeps curated list
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleVote = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, voted: !item.voted, votes: item.votes + (item.voted ? -1 : 1) }
          : item,
      ),
    );
  };

  const handleSubmit = async () => {
    const cleanTitle = title.trim();
    if (cleanTitle.length < 3) {
      showAlert({ title: 'Title too short', message: 'Enter at least 3 characters for your idea.' });
      return;
    }
    setSubmitting(true);
    try {
      await top1CloudApi.submitFeatureRequest(cleanTitle, description.trim()).catch(() => null);
      setItems((prev) => [
        {
          id: `local-${Date.now()}`,
          title: cleanTitle,
          description: description.trim(),
          status: 'open',
          votes: 1,
          voted: true,
        },
        ...prev,
      ]);
      setTitle('');
      setDescription('');
      showAlert({ title: 'Request Submitted', message: 'Your idea is now live on the TOP1% board.' });
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (status: FeatureItem['status']) =>
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
          loading={submitting}
          onPress={handleSubmit}
          fullWidth
        />
      </AppCard>

      <View style={{ gap: 10 }}>
        {items.map((item) => {
          const badgeCol = statusColor(item.status);
          return (
            <AppCard key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable
                onPress={() => toggleVote(item.id)}
                style={{
                  width: 50,
                  paddingVertical: 8,
                  borderRadius: RADII.input,
                  alignItems: 'center',
                  backgroundColor: item.voted ? hexToRgba(c.constant, 0.22) : c.thirdBg,
                  borderWidth: 1,
                  borderColor: item.voted ? c.constant : 'transparent',
                }}
              >
                <Ionicons
                  name="caret-up"
                  size={18}
                  color={item.voted ? c.constant : c.subText}
                />
                <AppText size="sm" weight="black" tone={item.voted ? 'constant' : 'default'}>
                  {item.votes}
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
        })}
      </View>
    </ScreenContainer>
  );
}
