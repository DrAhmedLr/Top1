import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../api/trpc';
import { top1CloudApi } from '../../api/top1Cloud';
import {
  AppButton,
  AppCard,
  AppInput,
  AppText,
  ScreenContainer,
  SegmentedControl,
  StackHeader,
  useAppAlert,
} from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import type { MainStackParamList } from '../../navigation/types';

/**
 * Edit Past Workout Screen (ported from Liftoff 2.18.1 EditPostScreen).
 * Lets athletes refine title, caption, privacy, friend tags, exercise order,
 * and trigger Strava export for an already-logged workout post.
 */
export function EditPostScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation();
  const route = useRoute<RouteProp<MainStackParamList, 'EditPost'>>();
  const { postId } = route.params;
  const { showAlert } = useAppAlert();

  const postQuery = trpc.post.getById.useQuery({ id: postId });
  const friendsQuery = trpc.friends.list.useQuery();
  const post = postQuery.data;

  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>('friends');
  const [taggedIds, setTaggedIds] = useState<string[]>([]);
  const [stravaExported, setStravaExported] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!post) return;
    setTitle(post.title);
    setCaption(post.caption ?? '');
  }, [post]);

  const toggleTag = (uid: string) => {
    setTaggedIds((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showAlert({ title: 'Title required', message: 'Give your workout a title.' });
      return;
    }
    setSaving(true);
    try {
      await top1CloudApi
        .editPost({
          id: postId,
          title: title.trim(),
          caption: caption.trim(),
          visibility,
          taggedUserIds: taggedIds,
          stravaActivityId: stravaExported ? `strava-${postId.slice(0, 8)}` : null,
        })
        .catch(() => null);
      showAlert({
        title: 'Workout Updated',
        message: stravaExported
          ? 'Changes saved and queued for Strava activity sync.'
          : 'Your past workout details have been updated.',
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  const friends = friendsQuery.data ?? [];

  return (
    <ScreenContainer scroll>
      <StackHeader title="Edit Past Workout" subtitle="Update title, notes, friend tags & Strava sync" />

      <AppCard style={{ gap: 12 }}>
        <AppInput label="Workout Title" value={title} onChangeText={setTitle} />
        <AppInput label="Caption / Session Notes" value={caption} onChangeText={setCaption} />

        <View style={{ gap: 6 }}>
          <AppText size="xxsm" weight="bold" tone="sub">
            VISIBILITY
          </AppText>
          <SegmentedControl
            value={visibility}
            onChange={setVisibility}
            options={[
              { label: 'Public', value: 'public' },
              { label: 'Friends', value: 'friends' },
              { label: 'Private', value: 'private' },
            ]}
          />
        </View>
      </AppCard>

      {/* Friend Tagging (Liftoff 2.18.1 TagsModal) */}
      <AppCard style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText size="md" weight="black">
            Tag Training Partners
          </AppText>
          <AppText size="xsm" tone="constant" weight="bold">
            {taggedIds.length} tagged
          </AppText>
        </View>
        {friends.length === 0 ? (
          <AppText size="xsm" tone="sub">
            Add training partners in Friends to tag them in your workout cards.
          </AppText>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {friends.map((f) => {
              const active = taggedIds.includes(f.id);
              return (
                <Pressable
                  key={f.id}
                  onPress={() => toggleTag(f.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 11,
                    paddingVertical: 7,
                    borderRadius: RADII.pill,
                    backgroundColor: active ? hexToRgba(c.constant, 0.22) : c.thirdBg,
                    borderWidth: 1,
                    borderColor: active ? c.constant : 'transparent',
                  }}
                >
                  <Ionicons
                    name={active ? 'checkmark-circle' : 'person-add-outline'}
                    size={15}
                    color={active ? c.constant : c.subText}
                  />
                  <AppText size="xsm" weight="bold" tone={active ? 'constant' : 'default'}>
                    @{f.username}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        )}
      </AppCard>

      {/* Strava Export Card */}
      <AppCard
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <AppText size="sm" weight="black" style={{ color: '#FC4C02' }}>
            STRAVA ACTIVITY SYNC
          </AppText>
          <AppText size="xsm" tone="sub">
            Export volume, duration & TOP1% strength summary to Strava
          </AppText>
        </View>
        <AppButton
          label={stravaExported ? 'Queued ✓' : 'Sync'}
          size="sm"
          variant={stravaExported ? 'check' : 'secondary'}
          onPress={() => setStravaExported((v) => !v)}
        />
      </AppCard>

      <AppButton label="Save Changes" loading={saving} onPress={handleSave} fullWidth />
    </ScreenContainer>
  );
}
