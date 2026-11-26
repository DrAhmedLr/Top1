import React, { useState } from 'react';
import { Image, Modal, Platform, Share, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDuration, formatWeight, RANKED_MUSCLE_GROUPS, type RankTier, type WeightUnit } from '@apexlift/shared';
import { V4_UI_URLS } from '../../assets/v4MediaManifest';
import { JymboRive } from '../mascot';
import { MuscleBodygraphSvg, type MuscleRankEntry } from '../rank/MuscleBodygraphSvg';
import { AppButton, AppText, RankBadge } from '../ui';
import { RANK_SOLID_ACCENT } from '../../theme/rankGradients';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import { notifySuccess } from '../../utils/haptics';
import { playSound } from '../../utils/soundscape';

export interface ShareCardModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  authorName: string;
  durationSeconds: number;
  totalVolumeKg: number;
  totalSets: number;
  prCount: number;
  unit: WeightUnit;
  tier?: RankTier;
  workedMuscles?: string[];
}

export function ShareCardModal({
  visible,
  onClose,
  title,
  authorName,
  durationSeconds,
  totalVolumeKg,
  totalSets,
  prCount,
  unit,
  tier = 'Veteran',
  workedMuscles = [],
}: ShareCardModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const accent = RANK_SOLID_ACCENT[tier] ?? c.constant;
  const [copied, setCopied] = useState(false);

  const musclesMap: Record<string, MuscleRankEntry> = {};
  for (const m of RANKED_MUSCLE_GROUPS) {
    const hit = workedMuscles.includes(m);
    musclesMap[m] = {
      muscle: m,
      rating: hit ? 540 : 0,
      tier: hit ? tier : 'Unranked',
      division: 1,
      label: hit ? tier : 'Unranked',
      topExerciseName: null,
      topExerciseId: null,
      exerciseCount: hit ? 1 : 0,
    };
  }

  const handleShare = async () => {
    const summary = `🏋️ ${title} by @${authorName}\n⏱ ${formatDuration(durationSeconds)} • 💪 ${formatWeight(totalVolumeKg, unit)} • ✅ ${totalSets} sets • 🏆 ${prCount} PRs\nTracked with TOP1% · https://top1.fit`;
    playSound('challenge_claim');
    notifySuccess();
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(summary);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
          onClose();
        }, 1200);
        return;
      }
      await Share.share({ message: summary });
    } catch {
      // non-fatal
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(8, 5, 16, 0.88)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <LinearGradient
          colors={[hexToRgba(accent, 0.24), c.secondBg, c.background]}
          style={{
            width: '100%',
            maxWidth: 380,
            borderRadius: RADII.cardLarge,
            borderWidth: 1.5,
            borderColor: hexToRgba(accent, 0.55),
            padding: 20,
            gap: 14,
          }}
        >
          {/* Card Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <AppText size="xxsm" weight="black" style={{ color: accent, letterSpacing: 1.3 }}>
                TOP1% WORKOUT CARD
              </AppText>
              <AppText size="lg" weight="black" numberOfLines={2}>
                {title}
              </AppText>
              <AppText size="xsm" tone="sub">
                @{authorName}
              </AppText>
            </View>
            <RankBadge tier={tier} division={1} size={56} showShine />
          </View>

          {/* Front + Back Muscle Heatmap */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-around',
              alignItems: 'center',
              backgroundColor: theme.dark ? 'rgba(10, 7, 20, 0.55)' : c.thirdBg,
              borderRadius: RADII.card,
              paddingVertical: 12,
              borderWidth: 1,
              borderColor: theme.dark ? hexToRgba('#FFFFFF', 0.08) : hexToRgba('#000000', 0.08),
            }}
          >
            <MuscleBodygraphSvg muscles={musclesMap} side="front" height={175} />
            <MuscleBodygraphSvg muscles={musclesMap} side="back" height={175} />
          </View>

          {/* 4 Stat Tiles */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { label: 'DURATION', val: formatDuration(durationSeconds), art: V4_UI_URLS.share_statduration },
              {
                label: 'VOLUME',
                val: `${Math.round(unit === 'lbs' ? totalVolumeKg * 2.20462 : totalVolumeKg).toLocaleString()} ${unit}`,
                art: V4_UI_URLS.share_statvolume,
              },
              { label: 'SETS', val: String(totalSets), art: V4_UI_URLS.share_statxp },
              { label: 'PRs', val: String(prCount), art: V4_UI_URLS.share_statrecords },
            ].map((st) => (
              <View
                key={st.label}
                style={{
                  flex: 1,
                  backgroundColor: theme.dark ? hexToRgba('#FFFFFF', 0.05) : c.thirdBg,
                  borderRadius: 12,
                  paddingVertical: 8,
                  paddingHorizontal: 4,
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Image source={{ uri: st.art }} resizeMode="contain" style={{ width: 20, height: 20 }} />
                <AppText size="xsm" weight="black" tabular numberOfLines={1}>
                  {st.val}
                </AppText>
                <AppText size="xxsm" tone="sub">
                  {st.label}
                </AppText>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <JymboRive pose="Selfie" size={50} showShadow={false} />
              <AppText size="xsm" weight="bold" tone="sub">
                Logged on TOP1%
              </AppText>
            </View>
            <AppText size="xsm" weight="black" tone="constant">
              top1.fit
            </AppText>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <AppButton label="Close" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <AppButton
              label={copied ? 'Copied to Clipboard ✓' : 'Share / Copy'}
              variant={copied ? 'check' : 'primary'}
              onPress={handleShare}
              style={{ flex: 1.5 }}
            />
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}
