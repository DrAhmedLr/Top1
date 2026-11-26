import React, { useMemo } from 'react';
import { Linking, Share, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { top1CloudApi } from '../../api/top1Cloud';
import { AppButton, AppModal, AppText } from '../ui';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';

/**
 * Deterministic visual QR pattern seeded by the athlete's public TOP1% share URL
 * (finder patterns in 3 corners + deterministic payload modules).
 */
function buildMatrix(seedText: string, size = 21): boolean[][] {
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const border = r === 0 || r === 6 || c === 0 || c === 6;
        const center = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[r0 + r][c0 + c] = border || center;
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  let state = hash >>> 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inFinder =
        (r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8);
      if (inFinder) continue;
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      grid[r][c] = (state & 1) === 1;
    }
  }
  return grid;
}

/**
 * Profile QR Code & Public Share Modal (Liftoff 2.18.1 ProfileQrCodeModal
 * connected directly to Top1.Fit's live `/share/[username]` & `/api/og` card).
 */
export function ProfileQrCodeModal({
  visible,
  onClose,
  username,
  displayName,
  standingLabel,
}: {
  visible: boolean;
  onClose: () => void;
  username: string;
  displayName: string;
  standingLabel: string;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const cleanUser = username || 'athlete';
  const shareUrl = top1CloudApi.getPublicShareUrl(cleanUser);
  const matrix = useMemo(() => buildMatrix(shareUrl, 21), [shareUrl]);
  const cell = 8;
  const svgSize = matrix.length * cell;

  const handleShare = async () => {
    try {
      await Share.share({
        title: `${displayName} on TOP1%`,
        message: `Check out my verified TOP1% athlete profile (${standingLabel}): ${shareUrl}`,
        url: shareUrl,
      });
    } catch {
      // cancelled
    }
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      title="Share TOP1% Profile"
      subtitle={`Verified public card at top1.fit/share/${cleanUser}`}
    >
      <View style={{ alignItems: 'center', gap: 14 }}>
        <View
          style={{
            padding: 16,
            borderRadius: RADII.card,
            backgroundColor: '#FFFFFF',
            borderWidth: 2,
            borderColor: hexToRgba(c.constant, 0.7),
          }}
        >
          <Svg width={svgSize} height={svgSize}>
            <Rect width={svgSize} height={svgSize} fill="#FFFFFF" />
            {matrix.map((row, r) =>
              row.map((on, col) =>
                on ? (
                  <Rect
                    key={`${r}-${col}`}
                    x={col * cell}
                    y={r * cell}
                    width={cell}
                    height={cell}
                    rx={1.5}
                    fill="#0F0A18"
                  />
                ) : null,
              ),
            )}
          </Svg>
        </View>

        <View style={{ alignItems: 'center', gap: 2 }}>
          <AppText size="lg" weight="black">
            {displayName}
          </AppText>
          <AppText size="sm" weight="bold" tone="constant">
            @{cleanUser} • {standingLabel}
          </AppText>
          <AppText size="xxsm" tone="sub">
            {shareUrl}
          </AppText>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
          <AppButton label="Share Link" onPress={handleShare} style={{ flex: 1 }} />
          <AppButton
            label="Open Web Card"
            variant="secondary"
            onPress={() => void Linking.openURL(shareUrl)}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </AppModal>
  );
}
