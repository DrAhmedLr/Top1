import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { trpc } from '../../api/trpc';
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
import type { MainStackParamList } from '../../navigation/types';

export function EditPostScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<MainStackParamList, 'EditPost'>>();
  const { postId } = route.params;
  const { showAlert } = useAppAlert();
  const utils = trpc.useUtils();

  const postQuery = trpc.post.getById.useQuery({ id: postId });
  const post = postQuery.data;

  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>('friends');

  useEffect(() => {
    if (!post) return;
    setTitle(post.title);
    setCaption(post.caption ?? '');
    if (
      post.visibility === 'public' ||
      post.visibility === 'friends' ||
      post.visibility === 'private'
    ) {
      setVisibility(post.visibility);
    }
  }, [post]);

  const editPost = trpc.post.editPost.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.post.feed.invalidate(),
        utils.post.getById.invalidate({ id: postId }),
      ]);
      showAlert({
        title: 'Workout Updated',
        message: 'Your workout title, notes, and visibility have been saved.',
      });
      navigation.goBack();
    },
    onError: (err) => {
      showAlert({ title: 'Update Failed', message: err.message });
    },
  });

  const handleSave = () => {
    if (!title.trim()) {
      showAlert({ title: 'Title required', message: 'Give your workout a title.' });
      return;
    }
    editPost.mutate({
      id: postId,
      title: title.trim(),
      caption: caption.trim(),
      visibility,
    });
  };

  return (
    <ScreenContainer scroll>
      <StackHeader title="Edit Workout Details" subtitle="Update title, session notes & visibility" />

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

      <AppButton label="Save Changes" loading={editPost.isPending} onPress={handleSave} fullWidth />
    </ScreenContainer>
  );
}
