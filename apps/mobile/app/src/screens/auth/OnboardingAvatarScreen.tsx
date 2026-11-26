import React, { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AvatarConfig, RankTier } from '@apexlift/shared';
import { AVATAR_PRESET_IMAGES, AVATAR_PRESET_KEYS } from '../../assets/assetRegistry';
import {
  AVATAR_BEARD_STYLES,
  AVATAR_BODY_TYPES,
  AVATAR_COMPLEXION_STYLES,
  AVATAR_DISPLAY_MODES,
  AVATAR_EYE_SHAPES,
  AVATAR_HAIR_COLORS,
  AVATAR_HAIR_STYLES,
  AVATAR_HEAD_SHAPES,
  AVATAR_MOUTH_SHAPES,
  AVATAR_MUSTACHE_STYLES,
  AVATAR_SKIN_TONES,
  CustomAvatarRive,
  JymboDialogue,
  type AvatarDisplayMode,
} from '../../components/mascot';
import {
  AppButton,
  AppCard,
  AppText,
  AvatarView,
  ScreenContainer,
  SegmentedControl,
  StackHeader,
} from '../../components/ui';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba } from '../../theme/tokens';
import { impactLight } from '../../utils/haptics';
import { playSound } from '../../utils/soundscape';

type Props = NativeStackScreenProps<AuthStackParamList, 'OnboardingAvatar'>;

type StudioTab = 'body' | 'face' | 'hair' | 'facial' | 'bodygraph';

const DEMO_BODYGRAPH_TIERS: Partial<Record<string, RankTier>> = {
  'Upper Chest': 'Champion',
  'Lower Chest': 'Elite',
  Biceps: 'Veteran',
  Triceps: 'Veteran',
  'Front Delt': 'Elite',
  'Middle Delt': 'Enthusiast',
  Abdominals: 'Titan',
  Quadriceps: 'Champion',
  Lats: 'Elite',
  'Upper Back': 'Veteran',
  Glutes: 'Enthusiast',
  Hamstrings: 'Veteran',
};

export function OnboardingAvatarScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const avatar = useAuthStore((s) => s.onboardingDraft.avatarConfig);
  const patchDraft = useAuthStore((s) => s.patchOnboardingDraft);

  const [mode, setMode] = useState<'rive' | 'presets'>('rive');
  const [studioTab, setStudioTab] = useState<StudioTab>('body');
  const [selectedPreset, setSelectedPreset] = useState(AVATAR_PRESET_KEYS[0] ?? 'malev31');

  // Live custom_avatar.riv ViewModel properties
  const [displayMode, setDisplayMode] = useState<AvatarDisplayMode>('display_default');
  const [bodyType, setBodyType] = useState<string>('body_A');
  const [headShape, setHeadShape] = useState<string>('headShape_A');
  const [eyeShape, setEyeShape] = useState<string>('eyeShape_A3');
  const [mouthShape, setMouthShape] = useState<string>('mouthShape_B');
  const [complexionStyle, setComplexionStyle] = useState<string>('complexionStyle_A');
  const [hairStyle, setHairStyle] = useState<string>('hairStyle_C1');
  const [beardStyle, setBeardStyle] = useState<string>('beardStyle_A');
  const [mustacheStyle, setMustacheStyle] = useState<string>('mustacheStyle_A');

  const updateAvatar = (partial: Partial<AvatarConfig>) => {
    impactLight();
    playSound('tick', 0.4);
    patchDraft({ avatarConfig: { ...avatar, ...partial } });
  };

  const pickOption = (setter: (v: string) => void, val: string) => {
    impactLight();
    playSound('tick', 0.4);
    setter(val);
  };

  const renderPillRow = (
    label: string,
    items: ReadonlyArray<{ id: string; label: string }>,
    current: string,
    onSelect: (id: string) => void
  ) => (
    <View style={{ gap: 8 }}>
      <AppText size="xsm" weight="bold" tone="sub">
        {label.toUpperCase()}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items.map((item) => {
          const active = current === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => onSelect(item.id)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 10,
                backgroundColor: active ? c.constant : c.thirdBg,
                borderWidth: 1,
                borderColor: active ? c.constantOvertone : 'transparent',
              }}
            >
              <AppText size="xsm" weight="bold" tone={active ? 'constantT' : 'reg'}>
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="Create Your Lifter" onBack={() => navigation.goBack()} />
      <ScreenContainer scroll safeTop={false} contentStyle={{ paddingTop: 10 }}>
        <JymboDialogue
          mascotPose="Selfie"
          mascotSize={80}
          mascotText="Customize your live 60fps Rive lifter — toggle Body, Face, Hair, or preview your BodyRank glow!"
        />

        <SegmentedControl
          options={[
            { value: 'rive', label: 'Live Rive Studio' },
            { value: 'presets', label: '3D Presets (12)' },
          ]}
          value={mode}
          onChange={(v) => {
            playSound('tick', 0.4);
            setMode(v);
          }}
        />

        {/* Hero Preview */}
        <AppCard variant="gradient" style={{ alignItems: 'center', paddingVertical: 14, gap: 10 }}>
          {mode === 'rive' ? (
            <>
              <CustomAvatarRive
                width={230}
                height={230}
                avatarDisplay={displayMode}
                bodyType={bodyType}
                headShape={headShape}
                eyeShape={eyeShape}
                mouthShape={mouthShape}
                complexionStyle={complexionStyle}
                hairStyle={hairStyle}
                beardStyle={beardStyle}
                mustacheStyle={mustacheStyle}
                skinTone={avatar.skinTone}
                hairColor={avatar.hairColor}
                muscleTiers={DEMO_BODYGRAPH_TIERS}
                fallback={<AvatarView config={avatar} size={140} borderColor={c.constant} />}
              />
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                {AVATAR_DISPLAY_MODES.map((dm) => {
                  const active = displayMode === dm.id;
                  return (
                    <Pressable
                      key={dm.id}
                      onPress={() => {
                        impactLight();
                        playSound('tick', 0.4);
                        setDisplayMode(dm.id);
                      }}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 99,
                        backgroundColor: active ? c.constant : c.thirdBg,
                      }}
                    >
                      <AppText size="xxsm" weight="bold" tone={active ? 'constantT' : 'sub'}>
                        {dm.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <AvatarView presetKey={selectedPreset} size={148} borderId="shp_border_gold" />
          )}
        </AppCard>

        {mode === 'rive' ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {(
                [
                  { id: 'body', label: 'Body & Skin' },
                  { id: 'face', label: 'Face' },
                  { id: 'hair', label: 'Hair' },
                  { id: 'facial', label: 'Facial Hair' },
                  { id: 'bodygraph', label: 'Bodygraph View' },
                ] as const
              ).map((t) => {
                const active = studioTab === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => {
                      impactLight();
                      playSound('tick', 0.35);
                      setStudioTab(t.id);
                      if (t.id === 'bodygraph') {
                        setDisplayMode('display_bodygraphFront');
                      } else if (displayMode.includes('bodygraph')) {
                        setDisplayMode('display_default');
                      }
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 99,
                      backgroundColor: active ? c.constant : c.secondBg,
                      borderWidth: 1,
                      borderColor: active ? c.constantOvertone : c.thirdBg,
                    }}
                  >
                    <AppText size="xsm" weight="bold" tone={active ? 'constantT' : 'sub'}>
                      {t.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>

            <AppCard variant="second_outlined" style={{ gap: 14 }}>
              {studioTab === 'body' ? (
                <>
                  <View style={{ gap: 8 }}>
                    <AppText size="xsm" weight="bold" tone="sub">
                      SKIN TONE
                    </AppText>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {AVATAR_SKIN_TONES.map((tone) => (
                        <Pressable
                          key={tone}
                          onPress={() => updateAvatar({ skinTone: tone })}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: tone,
                            borderWidth: avatar.skinTone === tone ? 3 : 1,
                            borderColor: avatar.skinTone === tone ? c.constant : c.thirdBg,
                          }}
                        />
                      ))}
                    </View>
                  </View>
                  {renderPillRow('Body Type', AVATAR_BODY_TYPES, bodyType, (v) => pickOption(setBodyType, v))}
                </>
              ) : null}

              {studioTab === 'face' ? (
                <>
                  {renderPillRow('Head Shape', AVATAR_HEAD_SHAPES, headShape, (v) => pickOption(setHeadShape, v))}
                  {renderPillRow('Eyes', AVATAR_EYE_SHAPES, eyeShape, (v) => pickOption(setEyeShape, v))}
                  {renderPillRow('Mouth', AVATAR_MOUTH_SHAPES, mouthShape, (v) => pickOption(setMouthShape, v))}
                  {renderPillRow('Complexion', AVATAR_COMPLEXION_STYLES, complexionStyle, (v) =>
                    pickOption(setComplexionStyle, v)
                  )}
                </>
              ) : null}

              {studioTab === 'hair' ? (
                <>
                  <View style={{ gap: 8 }}>
                    <AppText size="xsm" weight="bold" tone="sub">
                      HAIR COLOR
                    </AppText>
                    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                      {AVATAR_HAIR_COLORS.map((col) => (
                        <Pressable
                          key={col}
                          onPress={() => updateAvatar({ hairColor: col })}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 17,
                            backgroundColor: col,
                            borderWidth: avatar.hairColor === col ? 3 : 1,
                            borderColor: avatar.hairColor === col ? c.constant : 'rgba(255,255,255,0.2)',
                          }}
                        />
                      ))}
                    </View>
                  </View>
                  {renderPillRow('Hair Style', AVATAR_HAIR_STYLES, hairStyle, (v) => pickOption(setHairStyle, v))}
                </>
              ) : null}

              {studioTab === 'facial' ? (
                <>
                  {renderPillRow('Beard', AVATAR_BEARD_STYLES, beardStyle, (v) => pickOption(setBeardStyle, v))}
                  {renderPillRow('Mustache', AVATAR_MUSTACHE_STYLES, mustacheStyle, (v) =>
                    pickOption(setMustacheStyle, v)
                  )}
                </>
              ) : null}

              {studioTab === 'bodygraph' ? (
                <View style={{ gap: 10 }}>
                  <AppText size="sm" weight="bold">
                    Live Rive BodyRank Projection
                  </AppText>
                  <AppText size="xsm" tone="sub">
                    Every muscle group on your rigged Rive character lights up dynamically with your rank tier gradients as you log PRs.
                  </AppText>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <AppButton
                      title="Front View"
                      size="sm"
                      variant={displayMode === 'display_bodygraphFront' ? 'primary' : 'secondary'}
                      onPress={() => setDisplayMode('display_bodygraphFront')}
                      style={{ flex: 1 }}
                    />
                    <AppButton
                      title="Back View"
                      size="sm"
                      variant={displayMode === 'display_bodygraphBack' ? 'primary' : 'secondary'}
                      onPress={() => setDisplayMode('display_bodygraphBack')}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              ) : null}
            </AppCard>
          </>
        ) : (
          <AppCard
            variant="second_outlined"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}
          >
            {AVATAR_PRESET_KEYS.map((key) => {
              const active = selectedPreset === key;
              const src = AVATAR_PRESET_IMAGES[key];
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    impactLight();
                    playSound('tick', 0.45);
                    setSelectedPreset(key);
                  }}
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 34,
                    overflow: 'hidden',
                    borderWidth: active ? 3 : 1.5,
                    borderColor: active ? c.constant : c.thirdBg,
                    backgroundColor: active ? hexToRgba(c.constant, 0.2) : c.thirdBg,
                  }}
                >
                  {src ? <Image source={src} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
                </Pressable>
              );
            })}
          </AppCard>
        )}

        <AppButton
          title="Save Avatar & Create Account"
          size="lg"
          onPress={() => {
            playSound('flow_complete');
            navigation.navigate('OnboardingCredentials');
          }}
        />
      </ScreenContainer>
    </View>
  );
}
