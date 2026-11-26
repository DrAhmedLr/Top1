import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { formatWeight, type RankTier } from '@apexlift/shared';
import { trpc } from '../../api/trpc';
import { getArchetypeImage, STREAK_IMAGES } from '../../assets/assetRegistry';
import { ConfettiOverlay, TreasureChestModal } from '../../components/fx';
import { JymboRive } from '../../components/mascot';
import { AppButton, AppText, RankBadge, ScreenContainer } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { USE_NATIVE_DRIVER } from '../../theme/animations';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import { impactHeavy, impactLight, impactMedium, notifySuccess } from '../../utils/haptics';
import { playRankTierSting, playSound } from '../../utils/soundscape';

const PLATE_WEIGHTS = ['45', '45', '45', '25', '10'];
const STREAK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function RecapStoriesScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const unit = user?.unitWeight ?? 'lbs';

  const recapQuery = trpc.gamification.getRecapSnapshot.useQuery();
  const snap = recapQuery.data;
  const [slideIdx, setSlideIdx] = useState(0);
  const [chestOpen, setChestOpen] = useState(false);

  // Beat animations for TotalVolumeStory (plates dropping), LongestStreakStory (days popping), ArchetypeRevealStory (dramatic beat)
  const [landedPlates, setLandedPlates] = useState(0);
  const [poppedDays, setPoppedDays] = useState(0);
  const [archetypeRevealed, setArchetypeRevealed] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const heroScale = useRef(new Animated.Value(0.85)).current;

  const archetypeImg = snap ? getArchetypeImage(snap.archetype) : null;

  useEffect(() => {
    if (!snap) return;
    heroScale.setValue(0.85);
    Animated.spring(heroScale, {
      toValue: 1,
      friction: 6,
      tension: 150,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    if (slideIdx === 0) {
      setLandedPlates(0);
      const timers = PLATE_WEIGHTS.map((_, i) =>
        setTimeout(() => {
          setLandedPlates(i + 1);
          impactLight();
          playSound(i % 3 === 0 ? 'stat_card_1' : i % 3 === 1 ? 'stat_card_2' : 'stat_card_3', 0.6);
        }, 180 + i * 170)
      );
      return () => timers.forEach(clearTimeout);
    }

    if (slideIdx === 1) {
      setPoppedDays(0);
      const timers = STREAK_DAYS.map((_, i) =>
        setTimeout(() => {
          setPoppedDays(i + 1);
          impactLight();
          if (i === 2) playSound('streak_bump_1', 0.7);
          if (i === 5) playSound('streak_bump_2', 0.75);
          if (i === 6) playSound('streak_bump_3', 0.85);
        }, 140 + i * 130)
      );
      return () => timers.forEach(clearTimeout);
    }

    if (slideIdx === 2) {
      impactMedium();
      playRankTierSting(snap.peakTier);
      setConfettiKey((k) => k + 1);
      return;
    }

    if (slideIdx === 3) {
      setArchetypeRevealed(false);
      const t1 = setTimeout(() => {
        impactMedium();
        playSound('tick');
      }, 280);
      const t2 = setTimeout(() => {
        setArchetypeRevealed(true);
        impactHeavy();
        notifySuccess();
        playSound('fanfare');
        setConfettiKey((k) => k + 1);
      }, 720);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [slideIdx, snap, heroScale]);

  const slides = snap
    ? [
        {
          kicker: 'TOTAL VOLUME STORY',
          title: `${snap.totalWorkouts} Sessions Logged`,
          subtitle: 'Every dropped plate stacked into pure iron.',
          metric: formatWeight(snap.totalVolumeKg, unit),
          metricLabel: 'TOTAL VOLUME MOVED',
          accent: c.constant,
          hero: 'volume' as const,
        },
        {
          kicker: 'LONGEST STREAK STORY',
          title: `${snap.longestStreak}-Day Peak Streak`,
          subtitle: `Currently riding a ${snap.currentStreak}-day active streak.`,
          metric: `${snap.longestStreak} DAYS`,
          metricLabel: 'BEST STREAK',
          accent: '#F59E0B',
          hero: 'streak' as const,
        },
        {
          kicker: 'STRENGTH MASTERY',
          title: snap.peakRank,
          subtitle: 'Allometric bodyweight-adjusted average across your ranked lifts.',
          metric: `${snap.peakRating} SR`,
          metricLabel: 'PEAK BODYRANK RATING',
          accent: c.check,
          hero: 'badge' as const,
        },
        {
          kicker: 'YOUR LIFTER ARCHETYPE',
          title: archetypeRevealed ? snap.archetype : 'Analyzing Your Lifting DNA...',
          subtitle: archetypeRevealed ? snap.archetypeTagline : 'Hold tight — Jymbo is unveiling your archetype!',
          metric: `@${user?.username ?? 'athlete'}`,
          metricLabel: 'APEXLIFT IDENTITY',
          accent: '#D075E8',
          hero: 'archetype' as const,
        },
      ]
    : [];

  const activeSlide = slides[slideIdx];

  return (
    <ScreenContainer>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
        {slides.map((_, idx) => (
          <View
            key={idx}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 99,
              backgroundColor: idx <= slideIdx ? c.constant : c.thirdBg,
            }}
          />
        ))}
      </View>

      {activeSlide ? (
        <Pressable
          onPress={() => {
            if (slideIdx < slides.length - 1) setSlideIdx(slideIdx + 1);
            else navigation.goBack();
          }}
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 14,
            paddingHorizontal: 18,
            borderRadius: RADII.cardLarge,
            backgroundColor: hexToRgba(activeSlide.accent, 0.14),
            borderWidth: 1.5,
            borderColor: hexToRgba(activeSlide.accent, 0.48),
            overflow: 'hidden',
          }}
        >
          <ConfettiOverlay
            visible={slideIdx === 2 || (slideIdx === 3 && archetypeRevealed)}
            burstKey={confettiKey}
            count={32}
          />

          <AppText size="xsm" weight="black" style={{ color: activeSlide.accent, letterSpacing: 1.5 }}>
            {activeSlide.kicker}
          </AppText>

          {/* Slide 0: Dropping Stacked Plates + Jymbo Curling */}
          {activeSlide.hero === 'volume' ? (
            <Animated.View style={{ alignItems: 'center', gap: 10, transform: [{ scale: heroScale }] }}>
              <JymboRive pose="Curling" size={116} curlIntense />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 54 }}>
                {PLATE_WEIGHTS.map((w, i) => {
                  const landed = i < landedPlates;
                  const h = w === '45' ? 50 : w === '25' ? 40 : 30;
                  return (
                    <View
                      key={i}
                      style={{
                        width: 24,
                        height: h,
                        borderRadius: 6,
                        backgroundColor: landed ? activeSlide.accent : hexToRgba(c.thirdBg, 0.4),
                        opacity: landed ? 1 : 0.25,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: '#FFFFFF',
                      }}
                    >
                      <AppText size="xxsm" weight="black" tone="black">
                        {w}
                      </AppText>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          ) : null}

          {/* Slide 1: Popping Streak Calendar + Interactive Gold Chest */}
          {activeSlide.hero === 'streak' ? (
            <View style={{ alignItems: 'center', gap: 14, width: '100%' }}>
              <Pressable onPress={() => setChestOpen(true)} style={{ alignItems: 'center' }}>
                <View style={{ width: 120, height: 112, alignItems: 'center', justifyContent: 'center' }}>
                  {STREAK_IMAGES.chest_goldbottom ? (
                    <Image
                      source={STREAK_IMAGES.chest_goldbottom}
                      resizeMode="contain"
                      style={{ width: 108, height: 108, position: 'absolute' }}
                    />
                  ) : null}
                  {STREAK_IMAGES.chest_goldtop ? (
                    <Image
                      source={STREAK_IMAGES.chest_goldtop}
                      resizeMode="contain"
                      style={{ width: 108, height: 108, position: 'absolute', top: -4 }}
                    />
                  ) : null}
                </View>
                <AppText size="xsm" weight="black" style={{ color: '#FFE066' }}>
                  Tap Chest to Open Bonus Eggs!
                </AppText>
              </Pressable>

              <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
                {STREAK_DAYS.map((day, i) => {
                  const lit = i < poppedDays;
                  return (
                    <View
                      key={day}
                      style={{
                        width: 36,
                        height: 44,
                        borderRadius: 10,
                        backgroundColor: lit ? '#F59E0B' : c.thirdBg,
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                      }}
                    >
                      <Ionicons name="flame" size={14} color={lit ? '#0F0A18' : c.subText} />
                      <AppText size="xxsm" weight="black" tone={lit ? 'black' : 'sub'}>
                        {day}
                      </AppText>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Slide 2: Peak Sculpted Rank Badge */}
          {activeSlide.hero === 'badge' && snap ? (
            <Animated.View style={{ transform: [{ scale: heroScale }] }}>
              <RankBadge tier={snap.peakTier as RankTier} division={1} size={136} showShine floating />
            </Animated.View>
          ) : null}

          {/* Slide 3: Dramatic Archetype Beat Reveal */}
          {activeSlide.hero === 'archetype' ? (
            <View style={{ alignItems: 'center', gap: 8 }}>
              {archetypeRevealed && archetypeImg ? (
                <Image source={archetypeImg} resizeMode="contain" style={{ width: 176, height: 176 }} />
              ) : (
                <JymboRive pose="Pushups" size={140} />
              )}
            </View>
          ) : null}

          <AppText size="hero" weight="black" align="center">
            {activeSlide.title}
          </AppText>

          <AppText size="md" tone="sub" align="center">
            {activeSlide.subtitle}
          </AppText>

          <View
            style={{
              marginTop: 6,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: RADII.card,
              backgroundColor: 'rgba(15, 10, 24, 0.72)',
              borderWidth: 1,
              borderColor: hexToRgba(activeSlide.accent, 0.4),
              alignItems: 'center',
              gap: 3,
            }}
          >
            <AppText size="xxl" weight="black" style={{ color: activeSlide.accent }} tabular>
              {activeSlide.metric}
            </AppText>
            <AppText size="xsm" tone="sub">
              {activeSlide.metricLabel}
            </AppText>
          </View>

          <AppText size="xsm" tone="sub" style={{ marginTop: 6 }}>
            Tap anywhere to continue ({slideIdx + 1}/{slides.length})
          </AppText>
        </Pressable>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        {slideIdx > 0 ? (
          <AppButton
            label="Prev"
            variant="secondary"
            onPress={() => setSlideIdx(slideIdx - 1)}
            style={{ flex: 1 }}
          />
        ) : null}
        <AppButton
          label={slideIdx < slides.length - 1 ? 'Next Story' : 'Done'}
          onPress={() => {
            if (slideIdx < slides.length - 1) setSlideIdx(slideIdx + 1);
            else navigation.goBack();
          }}
          style={{ flex: 1.5 }}
        />
      </View>

      <TreasureChestModal
        visible={chestOpen}
        onClose={() => setChestOpen(false)}
        tier="gold"
        rewardEggs={150}
        rewardLabel="Gold Recap Streak Chest"
      />
    </ScreenContainer>
  );
}
