import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../api/trpc';
import { useTheme } from '../../theme/ThemeProvider';
import { RADII } from '../../theme/tokens';
import { AppButton, AppInput, AppModal, AppText, AvatarView } from '../ui';

interface CommentModalProps {
  postId: string | null;
  onClose: () => void;
}

export function CommentModal({ postId, onClose }: CommentModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const utils = trpc.useUtils();
  const [body, setBody] = useState('');

  const commentsQuery = trpc.postInteractions.listComments.useQuery(
    { postId: postId ?? '' },
    { enabled: Boolean(postId) }
  );

  const addComment = trpc.postInteractions.commentPost.useMutation({
    onSuccess: () => {
      setBody('');
      if (postId) utils.postInteractions.listComments.invalidate({ postId });
      utils.post.feed.invalidate();
    },
  });

  const likeComment = trpc.postInteractions.likeComment.useMutation({
    onSuccess: () => {
      if (postId) utils.postInteractions.listComments.invalidate({ postId });
    },
  });

  const comments = commentsQuery.data ?? [];

  return (
    <AppModal
      visible={Boolean(postId)}
      onClose={onClose}
      title={`Comments (${comments.length})`}
    >
      <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ gap: 10 }}>
        {comments.length === 0 ? (
          <AppText size="sm" tone="sub" align="center" style={{ paddingVertical: 16 }}>
            Be the first to drop props on this session!
          </AppText>
        ) : (
          comments.map((cm) => (
            <View
              key={cm.id}
              style={{
                flexDirection: 'row',
                gap: 10,
                padding: 10,
                borderRadius: RADII.input,
                backgroundColor: c.thirdBg,
              }}
            >
              <AvatarView config={cm.authorAvatar} size={34} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText size="xsm" weight="bold">
                    {cm.authorName} (@{cm.authorUsername})
                  </AppText>
                  <Pressable
                    onPress={() => likeComment.mutate({ commentId: cm.id })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                  >
                    <Ionicons name="heart-outline" size={14} color={c.subText} />
                    <AppText size="xsm" tone="sub">
                      {cm.likesCount}
                    </AppText>
                  </Pressable>
                </View>
                <AppText size="sm">{cm.body}</AppText>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <AppInput
          placeholder="Write a comment..."
          value={body}
          onChangeText={setBody}
          containerStyle={{ flex: 1 }}
        />
        <AppButton
          label="Send"
          size="sm"
          loading={addComment.isPending}
          onPress={() => {
            if (!postId || !body.trim()) return;
            addComment.mutate({ postId, body: body.trim() });
          }}
          style={{ height: 48 }}
        />
      </View>
    </AppModal>
  );
}
