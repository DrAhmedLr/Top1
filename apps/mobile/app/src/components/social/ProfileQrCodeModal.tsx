import React, { useMemo, useState } from 'react';
import { Linking, Platform, Share, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { top1CloudApi } from '../../api/top1Cloud';
import { encodeQrMatrix } from '../../lib/qrEncoder';
import { AppButton, AppModal, AppText } from '../ui';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';

/**
 * Genuine ISO/IEC 18004 Scannable Profile QR Code & Public Share Modal
 * pointing directly to `https://top1.fit/share/<username>`.
 */
export function ProfileQrCodeModal({
  visible,
  onClose,
  username,
  displayName,
  standingLabel,
  referralCode,
}: {
  visible: boolean;
  onClose: () => void;
  username: string;
  displayName: string;
  standingLabel: string;
  referralCode?: string;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [copied, setCopied] = useState(false);
  const cleanUser = username || 'athlete';
  const shareUrl = top1CloudApi.getPublicShareUrl(cleanUser);
  const matrix = useMemo(() => encodeQrMatrix(shareUrl), [shareUrl]);
  const quiet = 2;
  const cell = Math.max(4, Math.floor(196 / (matrix.length + quiet * 2)));
  const svgSize = (matrix.length + quiet * 2) * cell;

  const handleShare = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      } else {
        await Share.share({
          title: `${displayName} on TOP1%`,
          message: `Check out my TOP1% athlete profile (${standingLabel}): ${shareUrl}`,
          url: shareUrl,
        });
      }
    } catch {
      // cancelled
    }
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      title="Share TOP1% Profile"
      subtitle={`Scannable QR pass · top1.fit/share/${cleanUser}`}
    >
      <View style={{ alignItems: 'center', gap: 14 }}>
        <View
          style={{
            padding: 12,
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
                    x={(col + quiet) * cell}
                    y={(r + quiet) * cell}
                    width={cell}
                    height={cell}
                    fill="#0F0A18"
                  />
                ) : null,
              ),
            )}
          </Svg>
        </View>

        <View style={{ alignItems: 'center', gap: 3 }}>
          <AppText size="lg" weight="black">
            {displayName}
          </AppText>
          <AppText size="sm" weight="bold" tone="constant">
            @{cleanUser} • {standingLabel}
          </AppText>
          {referralCode ? (
            <AppText size="xsm" weight="bold" tone="sub">
              Invite Code: {referralCode}
            </AppText>
          ) : null}
          <AppText size="xxsm" tone="sub">
            {shareUrl}
          </AppText>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
          <AppButton
            label={copied ? 'Link Copied ✓' : Platform.OS === 'web' ? 'Copy Link' : 'Share Link'}
            variant={copied ? 'check' : 'primary'}
            onPress={handleShare}
            style={{ flex: 1 }}
          />
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
