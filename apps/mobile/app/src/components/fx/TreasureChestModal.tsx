import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { STREAK_IMAGES } from '../../assets/assetRegistry';
import { ONBOARDING_ASSETS } from '../../assets/v3AssetRegistry';
import { JymboRive } from '../mascot';
import { AppButton, AppText } from '../ui';
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
  rewardEggs?: number;
  rewardLabel?: string;
}

/**
 * Interactive 2-Piece Streak Treasure Chest Opening Modal modeled on
 * mod_03231_OpenedTreasureChest.js & mod_03232_RewardTreasureChestV2.js
 */
export function TreasureChestModal({
  visible,
  onClose,
  tier = 'gold',
  rewardEggs = 120,
  rewardLabel = 'Streak Reward Chest',
}: TreasureChestModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [taps, setTaps] = useState(0);
  const [opened, setOpened] = useState(false);

  const shakeX = useRef(new Animated.Value(0)).current;
  const lidY = useRef(new Animated.Value(0)).current;
  const lidRot = useRef(new Animated.Value(0)).current;
  const rewardScale = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    if (!visible) return;
    setTaps(0);
    setOpened(false);
    shakeX.setValue(0);
    lidY.setValue(0);
    lidRot.setValue(0);
    rewardScale.setValue(0.2);
  }, [visible, shakeX, lidY, lidRot, rewardScale]);

  const topImg = STREAK_IMAGES[`chest_${tier}top`] ?? STREAK_IMAGES.chest_goldtop;
  const bottomImg =
    STREAK_IMAGES[`chest_${tier}bottom`] ?? STREAK_IMAGES.chest_goldbottom;
  const eggImg = ONBOARDING_ASSETS.item_eggs;

  const handleTapChest = () => {
    if (opened) return;
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
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(8, 5, 16, 0.9)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <ConfettiOverlay visible={opened} count={40} />

        <LinearGradient
          colors={['#2B1E40', '#161026', '#0F0A18']}
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
              {opened ? (
                <Animated.View
                  style={{
                    position: 'absolute',
                    top: 6,
                    alignItems: 'center',
                    transform: [{ scale: rewardScale }],
                  }}
                >
                  {eggImg ? <Image source={eggImg} style={{ width: 64, height: 64 }} resizeMode="contain" /> : null}
                  <AppText size="xl" weight="black" style={{ color: '#FFE066' }} tabular>
                    +{rewardEggs} Eggs
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
              {opened
                ? `Jackpot! +${rewardEggs} Eggs added to your vault for the Cosmetics Shop!`
                : `Tap the chest ${3 - taps} more time${3 - taps === 1 ? '' : 's'} to crack it open!`}
            </AppText>
          </View>

          {opened ? (
            <AppButton title="Collect Eggs" variant="gold" size="lg" fullWidth onPress={onClose} />
          ) : (
            <AppButton title={`Tap Chest (${taps}/3)`} variant="primary" size="md" fullWidth onPress={handleTapChest} />
          )}
        </LinearGradient>
      </View>
    </Modal>
  );
}
