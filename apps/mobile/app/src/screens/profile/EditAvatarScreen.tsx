import React, { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { AvatarConfig, RankTier } from '@apexlift/shared';
import { trpc } from '../../api/trpc';
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
  useAppAlert,
} from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import { impactLight } from '../../utils/haptics';
import { playSound } from '../../utils/soundscape';

const OUTFIT_COLORS = ['#59B9F9', '#71D769', '#B465D0', '#F59E0B', '#EF4444', '#14B8A6'];

export function EditAvatarScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation();
  const { showAlert } = useAppAlert();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const mapQuery = trpc.rank.getMuscleMap.useQuery();
  const muscleTiers: Partial<Record<string, RankTier>> = {};
  for (const [mName, entry] of Object.entries(mapQuery.data?.muscles ?? {})) {
    muscleTiers[mName] = entry.tier as RankTier;
  }

  const [mode, setMode] = useState<'rive' | 'presets'>('rive');
  const [studioTab, setStudioTab] = useState<'body' | 'face' | 'hair' | 'facial' | 'bodygraph'>('body');
  const [selectedPreset, setSelectedPreset] = useState<string>(
    user?.rankingSex === 'Female' ? 'femalev31' : 'malev31'
  );
  const [displayMode, setDisplayMode] = useState<AvatarDisplayMode>('display_default');
  const [bodyType, setBodyType] = useState<string>('body_A');
  const [headShape, setHeadShape] = useState<string>('headShape_A');
  const [eyeShape, setEyeShape] = useState<string>('eyeShape_A1');
  const [mouthShape, setMouthShape] = useState<string>('mouthShape_B');
  const [complexionStyle, setComplexionStyle] = useState<string>('complexionStyle_A');
  const [hairStyle, setHairStyle] = useState<string>('hairStyle_C1');
  const [beardStyle, setBeardStyle] = useState<string>('beardStyle_A');
  const [mustacheStyle, setMustacheStyle] = useState<string>('mustacheStyle_A');

  const [config, setConfig] = useState<AvatarConfig>(
    user?.avatarConfig ?? {
      skinTone: '#E0AC69',
      hairStyle: 'fade',
      hairColor: '#1C1917',
      outfitColor: '#59B9F9',
      accessory: 'headphones',
      backgroundColor: '#1A1524',
    }
  );

  const saveMutation = trpc.user.updateProfile.useMutation({
    onSuccess: (updated) => {
      playSound('flow_complete');
      setUser(updated);
      navigation.goBack();
    },
    onError: (err) => showAlert({ title: 'Could not save avatar', message: err.message }),
  });

  const pick = (setter: (v: string) => void, val: string) => {
    impactLight();
    playSound('tick', 0.4);
    setter(val);
  };

  const SwatchRow = ({
    label,
    colors,
    selected,
    onSelect,
  }: {
    label: string;
    colors: string[];
    selected: string;
    onSelect: (v: string) => void;
  }) => (
    <View style={{ gap: 6 }}>
      <AppText size="xsm" weight="bold" tone="sub">
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        {colors.map((hex) => (
          <Pressable
            key={hex}
            onPress={() => {
              impactLight();
              playSound('tick', 0.35);
              onSelect(hex);
            }}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: hex,
              borderWidth: selected === hex ? 3 : 1,
              borderColor: selected === hex ? c.constant : 'rgba(255,255,255,0.2)',
            }}
          />
        ))}
      </View>
    </View>
  );

  const PillGroup = ({
    label,
    options,
    value,
    onChange,
  }: {
    label: string;
    options: ReadonlyArray<{ id: string; label: string }>;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <View style={{ gap: 6 }}>
      <AppText size="xsm" weight="bold" tone="sub">
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => pick(onChange, opt.id)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: RADII.pill,
                backgroundColor: active ? hexToRgba(c.constant, 0.22) : c.thirdBg,
                borderWidth: 1,
                borderColor: active ? c.constant : 'transparent',
              }}
            >
              <AppText size="xsm" weight="bold" tone={active ? 'constant' : 'default'}>
                {opt.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <ScreenContainer scroll>
      <StackHeader title="Avatar Studio" subtitle="Live Rive ViewModel Rig & 3D Presets" />

      <AppCard glowColor={c.constant} style={{ alignItems: 'center', paddingVertical: 18, gap: 10 }}>
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
              skinTone={config.skinTone}
              hairColor={config.hairColor}
              muscleTiers={muscleTiers}
              fallback={
                <AvatarView
                  config={config}
                  borderId={user?.equippedBorderId || 'shp_border_gold'}
                  size={120}
                  borderColor={c.constant}
                />
              }
            />
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {AVATAR_DISPLAY_MODES.map((dm) => {
                const active = displayMode === dm.id;
                return (
                  <Pressable
                    key={dm.id}
                    onPress={() => pick((v) => setDisplayMode(v as AvatarDisplayMode), dm.id)}
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
          <AvatarView
            config={config}
            borderId={user?.equippedBorderId || 'shp_border_gold'}
            presetKey={selectedPreset}
            size={126}
            borderColor={c.constant}
          />
        )}
      </AppCard>

      <SegmentedControl
        value={mode}
        onChange={setMode}
        options={[
          { label: 'Live Rive Rig', value: 'rive' },
          { label: '3D Presets (12)', value: 'presets' },
        ]}
      />

      {mode === 'rive' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {(
              [
                { id: 'body', label: 'Body' },
                { id: 'face', label: 'Face' },
                { id: 'hair', label: 'Hair' },
                { id: 'facial', label: 'Facial Hair' },
                { id: 'bodygraph', label: 'BodyRank View' },
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
                    if (t.id === 'bodygraph') setDisplayMode('display_bodygraphFront');
                    else if (displayMode.includes('bodygraph')) setDisplayMode('display_default');
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

          <AppCard style={{ gap: 14 }}>
            {studioTab === 'body' ? (
              <>
                <SwatchRow
                  label="SKIN TONE"
                  colors={AVATAR_SKIN_TONES}
                  selected={config.skinTone}
                  onSelect={(skinTone) => setConfig({ ...config, skinTone })}
                />
                <PillGroup label="BODY TYPE" options={AVATAR_BODY_TYPES} value={bodyType} onChange={setBodyType} />
                <SwatchRow
                  label="GEAR ACCENT"
                  colors={OUTFIT_COLORS}
                  selected={config.outfitColor}
                  onSelect={(outfitColor) => setConfig({ ...config, outfitColor })}
                />
              </>
            ) : null}

            {studioTab === 'face' ? (
              <>
                <PillGroup label="HEAD SHAPE" options={AVATAR_HEAD_SHAPES} value={headShape} onChange={setHeadShape} />
                <PillGroup label="EYES" options={AVATAR_EYE_SHAPES} value={eyeShape} onChange={setEyeShape} />
                <PillGroup label="MOUTH" options={AVATAR_MOUTH_SHAPES} value={mouthShape} onChange={setMouthShape} />
                <PillGroup
                  label="COMPLEXION"
                  options={AVATAR_COMPLEXION_STYLES}
                  value={complexionStyle}
                  onChange={setComplexionStyle}
                />
              </>
            ) : null}

            {studioTab === 'hair' ? (
              <>
                <SwatchRow
                  label="HAIR COLOR"
                  colors={AVATAR_HAIR_COLORS}
                  selected={config.hairColor}
                  onSelect={(hairColor) => setConfig({ ...config, hairColor })}
                />
                <PillGroup label="HAIR STYLE" options={AVATAR_HAIR_STYLES} value={hairStyle} onChange={setHairStyle} />
              </>
            ) : null}

            {studioTab === 'facial' ? (
              <>
                <PillGroup label="BEARD" options={AVATAR_BEARD_STYLES} value={beardStyle} onChange={setBeardStyle} />
                <PillGroup
                  label="MUSTACHE"
                  options={AVATAR_MUSTACHE_STYLES}
                  value={mustacheStyle}
                  onChange={setMustacheStyle}
                />
              </>
            ) : null}

            {studioTab === 'bodygraph' ? (
              <View style={{ gap: 10 }}>
                <AppText size="sm" weight="bold">
                  Live Muscle Tier Coloring
                </AppText>
                <AppText size="xsm" tone="sub">
                  Showing your real logged BodyRank tiers mapped onto custom_avatar.riv&apos;s muscle gradient slots.
                </AppText>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <AppButton
                    title="Front Bodygraph"
                    size="sm"
                    variant={displayMode === 'display_bodygraphFront' ? 'primary' : 'secondary'}
                    onPress={() => setDisplayMode('display_bodygraphFront')}
                    style={{ flex: 1 }}
                  />
                  <AppButton
                    title="Back Bodygraph"
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {AVATAR_PRESET_KEYS.map((key) => {
            const active = selectedPreset === key;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  impactLight();
                  playSound('tick', 0.4);
                  setSelectedPreset(key);
                }}
                style={{
                  width: '30.8%',
                  aspectRatio: 1,
                  borderRadius: 18,
                  overflow: 'hidden',
                  borderWidth: active ? 3 : 1,
                  borderColor: active ? c.constant : hexToRgba('#FFFFFF', 0.12),
                  backgroundColor: c.secondBg,
                }}
              >
                <Image source={AVATAR_PRESET_IMAGES[key]} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
              </Pressable>
            );
          })}
        </View>
      )}

      <AppButton
        label="Save Avatar"
        loading={saveMutation.isPending}
        onPress={() => saveMutation.mutate({ avatarConfig: config })}
        fullWidth
      />
    </ScreenContainer>
  );
}
