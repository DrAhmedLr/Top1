import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { trpc } from '../../api/trpc';
import { STREAK_IMAGES } from '../../assets/assetRegistry';
import { ONBOARDING_ASSETS } from '../../assets/v3AssetRegistry';
import { JymboRive } from '../mascot';
import { AppButton, AppText } from '../ui';
import { useAuthStore } from '../../stores/authStore';
import { USE_NATIVE_DRIVER } from '../../theme/animations';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import { impactHeavy, impactMedium, notifySuccess } from '../../utils/haptics';
import { playSound } from '../../utils/soundscape';
import { ConfettiOverlay } from './ConfettiOverlay';

export interface TreasureChestModalProps {
  visible: boolean;
  onClose: () => void;
  tier?: 'wood' | 'bronze' | 'silver' | 'gold';
  rewardLabel?: string;
}

/**
 * Server-Verified Daily Streak Vault Chest (once per UTC day).
 * Awards real Credits & XP via `trpc.gamification.claimDailyVault`.
 */
export function TreasureChestModal({
  visible,
  onClose,
  tier = 'gold',
  rewardLabel = 'Daily Streak Vault',
}: TreasureChestModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const utils = trpc.useUtils();
  const setUser = useAuthStore((s) => s.setUser);
  const [taps, setTaps] = useState(0);
  const [opened, setOpened] = useState(false);
  const [claimedResult, setClaimedResult] = useState<{
    credits: number;
    xp: number;
    alreadyClaimed: boolean;
  } | null>(null);

  const statusQuery = trpc.gamification.getDailyVaultStatus.useQuery(undefined, {
    enabled: visible,
  });

  const claimMutation = trpc.gamification.claimDailyVault.useMutation({
    onSuccess: async (res) => {
      setClaimedResult({
        credits: res.rewardCredits,
        xp: res.rewardXp,
        alreadyClaimed: res.alreadyClaimed,
      });
      void utils.gamification.getDailyVaultStatus.invalidate();
      void utils.shop.listCatalog.invalidate();
      try {
        const fresh = await utils.user.me.fetch();
        setUser(fresh);
      } catch {
        // non-blocking
      }
    },
  });

  const shakeX = useRef(new Animated.Value(0)).current;
  const lidY = useRef(new Animated.Value(0)).current;
  const lidRot = useRef(new Animated.Value(0)).current;
  const rewardScale = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    if (!visible) return;
    setTaps(0);
    setOpened(false);
    setClaimedResult(null);
    shakeX.setValue(0);
    lidY.setValue(0);
    lidRot.setValue(0);
    rewardScale.setValue(0.2);
  }, [visible, shakeX, lidY, lidRot, rewardScale]);

  const alreadyClaimed =
    Boolean(statusQuery.data?.claimedToday) || Boolean(claimedResult?.alreadyClaimed);
  const previewCredits = statusQuery.data?.rewardCredits ?? 50;
  const topImg = STREAK_IMAGES[`chest_${tier}top`] ?? STREAK_IMAGES.chest_goldtop;
  const bottomImg = STREAK_IMAGES[`chest_${tier}bottom`] ?? STREAK_IMAGES.chest_goldbottom;
  const vaultImg = ONBOARDING_ASSETS.item_eggs;

  const handleTapChest = () => {
    if (opened || alreadyClaimed || claimMutation.isPending) return;
    const next = taps + 1;
    setTaps(next);

    if (next < 3) {
      impactMedium();
      playSound('tick');
      Animated.sequence([
        Animated.timing(shakeX, { toValue: -10, duration: 55, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(shakeX, { toValue: 10, duration: 55, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(shakeX, { toValue: -6, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    } else {
      setOpened(true);
      impactHeavy();
      notifySuccess();
      playSound('eggs_burst');
      setTimeout(() => playSound('challenge_claim'), 220);

      Animated.parallel([
        Animated.spring(lidY, { toValue: -46, friction: 6, tension: 140, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(lidRot, { toValue: 1, friction: 6, tension: 140, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(rewardScale, { toValue: 1, friction: 5, tension: 150, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();

      claimMutation.mutate();
    }
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
        <ConfettiOverlay visible={opened && !alreadyClaimed} count={40} />

        <LinearGradient
          colors={[c.thirdBg, c.secondBg, c.background]}
          style={{
            width: '100%',
            maxWidth: 360,
            borderRadius: RADII.cardLarge,
            borderWidth: 1.5,
            borderColor: hexToRgba('#FFE066', 0.55),
            padding: 24,
            alignItems: 'center',
            gap: 16,
          }}
        >
          <AppText size="xsm" weight="black" style={{ color: '#FFE066', letterSpacing: 1.3 }}>
            {rewardLabel.toUpperCase()}
          </AppText>

          <Pressable onPress={handleTapChest} style={{ alignItems: 'center', paddingVertical: 14 }}>
            <Animated.View
              style={{
                width: 156,
                height: 156,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ translateX: shakeX }],
              }}
            >
              {opened && claimedResult && !claimedResult.alreadyClaimed ? (
                <Animated.View
                  style={{
                    position: 'absolute',
                    top: 6,
                    alignItems: 'center',
                    transform: [{ scale: rewardScale }],
                  }}
                >
                  {vaultImg ? <Image source={vaultImg} style={{ width: 58, height: 58 }} resizeMode="contain" /> : null}
                  <AppText size="xl" weight="black" style={{ color: '#FFE066' }} tabular>
                    +{claimedResult.credits} Credits
                  </AppText>
                  <AppText size="xsm" weight="bold" tone="constant">
                    +{claimedResult.xp} XP
                  </AppText>
                </Animated.View>
              ) : null}

              <Animated.View
                style={{
                  transform: [
                    { translateY: lidY },
                    {
                      rotate: lidRot.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '-18deg'],
                      }),
                    },
                  ],
                }}
              >
                {topImg ? <Image source={topImg} style={{ width: 120, height: 62 }} resizeMode="contain" /> : null}
              </Animated.View>
              {bottomImg ? (
                <Image
                  source={bottomImg}
                  style={{ width: 116, height: 52, marginTop: -8 }}
                  resizeMode="contain"
                />
              ) : null}
            </Animated.View>
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <JymboRive pose={opened ? 'Congrats' : 'Confident'} size={68} showShadow={false} />
            <AppText size="sm" weight="bold" tone="sub" style={{ flex: 1 }}>
              {alreadyClaimed && !opened
                ? 'Today’s Daily Vault has already been claimed. Train tomorrow to unlock the next vault!'
                : opened && claimedResult
                  ? `Claimed! +${claimedResult.credits} Credits and +${claimedResult.xp} XP added to your account.`
                  : `Tap the chest ${3 - taps} more time${3 - taps === 1 ? '' : 's'} to claim +${previewCredits} Credits!`}
            </AppText>
          </View>

          {alreadyClaimed || opened ? (
            <AppButton
              title={opened ? 'Done' : 'Come Back Tomorrow'}
              variant={opened ? 'gold' : 'secondary'}
              size="lg"
              fullWidth
              onPress={onClose}
            />
          ) : (
            <AppButton
              title={`Tap Vault (${taps}/3)`}
              variant="primary"
              size="md"
              fullWidth
              loading={claimMutation.isPending}
              onPress={handleTapChest}
            />
          )}
        </LinearGradient>
      </View>
    </Modal>
  );
}
