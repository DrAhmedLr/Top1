import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { trpc } from '../../api/trpc';
import { ONBOARDING_ASSETS } from '../../assets/v3AssetRegistry';
import { JymboRive, TextBubbleSys, type JymboPose } from '../../components/mascot';
import { AppButton, AppCard, AppText, RankBadge, ScreenContainer, useAlert } from '../../components/ui';
import { useLocale } from '../../i18n/LocaleProvider';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import { useResponsiveLayout } from '../../theme/useResponsiveLayout';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import { playSound } from '../../utils/soundscape';

type Props = NativeStackScreenProps<AuthStackParamList, 'Landing'>;

const HIGHLIGHTS: Array<{
  icon: keyof typeof Ionicons.glyphMap;
  title: [string, string, string];
  subtitle: [string, string, string];
  tier: 'Olympian' | 'Elite' | 'Champion';
  pose: JymboPose;
  jymboLine: [string, string, string];
  artKey: string;
}> = [
  {
    icon: 'trophy',
    title: ['Climb to the TOP 1%', 'Atteignez le TOP 1%', 'ارتقِ إلى أفضل 1%'],
    subtitle: [
      'Scientific percentile standing across Push, Pull, Lower, Running & 30+ peer-reviewed metrics.',
      'Classement scientifique sur Poussée, Tirage, Bas du corps, Course et 30+ indicateurs.',
      'تصنيف علمي شامل للدفع والسحب والجزء السفلي والجري وأكثر من 30 معياراً.',
    ],
    tier: 'Olympian',
    pose: 'Salute',
    jymboLine: [
      "Welcome to TOP1%! Ready to measure your real percentile & climb to Top 1%?",
      'Bienvenue sur TOP1% ! Prêt à mesurer votre rang réel et viser le Top 1% ?',
      'مرحباً بك في TOP1%! هل أنت مستعد لقياس مستواك الحقيقي والوصول إلى أفضل 1%؟',
    ],
    artKey: 'landing_landingvalue1',
  },
  {
    icon: 'barbell',
    title: ['Adaptive Coach & Physiology', 'Coach adaptatif & physiologie', 'مدرب ذكي وفسيولوجيا العضلات'],
    subtitle: [
      '19-muscle recovery %, MEV/MAV/MRV volume, Monte Carlo forecasting & smartwatch readiness.',
      'Récupération musculaire %, volume MEV/MAV/MRV, prévisions Monte Carlo et montre connectée.',
      'نسبة تعافي العضلات، حجم التدريب الأسبوعي، توقعات مونت كارلو وجاهزية الساعة الذكية.',
    ],
    tier: 'Elite',
    pose: 'Curling',
    jymboLine: [
      'Short on time or sore? Your deterministic coach adapts every set without junk volume!',
      'Peu de temps ou courbatures ? Votre coach adapte chaque série sans volume inutile !',
      'وقتك ضيق أو تشعر بإجهاد؟ مدربك الذكي يعدّل جلستك فوراً بأمان علمي!',
    ],
    artKey: 'landing_landingvalue2',
  },
  {
    icon: 'people',
    title: ['Full Mobile Experience', 'Expérience mobile complète', 'تجربة تطبيق متكاملة'],
    subtitle: [
      'Live workout tracker, anatomical Bodygraph, 630+ exercises, nutrition barcode & ranked leagues.',
      'Suivi live, Bodygraph anatomique, 630+ exercices, nutrition code-barres et ligues.',
      'تتبع تمارين مباشر، خريطة عضلات تفاعلية، 630+ تمرين، تغذية ودوريات تنافسية.',
    ],
    tier: 'Champion',
    pose: 'Congrats',
    jymboLine: [
      'Every logged set updates your muscle recovery, weekly volume, and TOP1% rank live!',
      'Chaque série enregistrée met à jour votre récupération et votre rang TOP1% en direct !',
      'كل مجموعة تسجلها تحدّث تعافي عضلاتك وترتيبك في TOP1% مباشرة!',
    ],
    artKey: 'landing_journeyv4landingvalue3',
  },
];

const DEMO_AUTH_ENABLED =
  (typeof __DEV__ !== 'undefined' && __DEV__) || process.env.EXPO_PUBLIC_ENABLE_DEMO_AUTH === 'true';

export function LandingScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const layout = useResponsiveLayout();
  const c = theme.colors;
  const { locale, setLocale, l } = useLocale();
  const { showAlert } = useAlert();
  const setSession = useAuthStore((s) => s.setSession);
  const [slideIdx, setSlideIdx] = useState(0);

  const demoSignIn = trpc.auth.signIn.useMutation({
    onSuccess: async (data) => {
      playSound('splash_short');
      await setSession(data);
    },
    onError: (err) => {
      showAlert({
        title: 'Unable to Sign In',
        message: err.message || 'Please retry in a moment.',
      });
    },
  });

  const activeSlide = HIGHLIGHTS[slideIdx];
  const slideArt = ONBOARDING_ASSETS[activeSlide.artKey];

  const brandHeader = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <LinearGradient
          colors={[c.constantOvertone, c.constant]}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="flash" size={20} color="#0F0A18" />
        </LinearGradient>
        <View>
          <AppText size="lg" weight="black" style={{ letterSpacing: 0.6 }}>
            TOP1%
          </AppText>
          <AppText size="xxsm" weight="bold" tone="constant">
            {l('SCIENTIFIC PERFORMANCE OS', 'PERFORMANCE SCIENTIFIQUE', 'نظام الأداء العلمي')}
          </AppText>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {(['en', 'fr', 'ar'] as const).map((code) => {
          const active = locale === code;
          return (
            <Pressable
              key={code}
              onPress={() => void setLocale(code)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 99,
                backgroundColor: active ? c.constant : c.secondBg,
                borderWidth: 1,
                borderColor: active ? c.constant : c.thirdBg,
              }}
            >
              <AppText size="xxsm" weight="black" tone={active ? 'constantT' : 'sub'}>
                {code.toUpperCase()}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const mascotShowcase = (
    <View style={{ alignItems: 'center', gap: layout.isDesktop ? 16 : 10, width: '100%' }}>
      <TextBubbleSys value={l(...activeSlide.jymboLine)} tailPlacement="bottom" textAlign="center" />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: layout.isDesktop ? 16 : 10 }}>
        <View style={{ opacity: 0.82, transform: [{ scale: layout.isDesktop ? 0.94 : 0.84 }] }}>
          <RankBadge tier="Elite" division={1} size={layout.isDesktop ? 68 : 58} />
        </View>
        <JymboRive pose={activeSlide.pose} size={layout.isDesktop ? 180 : 146} curlIntense={activeSlide.pose === 'Curling'} />
        <View style={{ opacity: 0.82, transform: [{ scale: layout.isDesktop ? 0.94 : 0.84 }] }}>
          <RankBadge tier={activeSlide.tier} division={1} size={layout.isDesktop ? 76 : 64} showShine />
        </View>
      </View>

      {slideArt ? (
        <View
          style={{
            width: '100%',
            height: layout.isDesktop ? 156 : 112,
            borderRadius: RADII.card,
            overflow: 'hidden',
            backgroundColor: c.secondBg,
            borderWidth: 1,
            borderColor: hexToRgba(c.constant, 0.25),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image source={slideArt} resizeMode="contain" style={{ width: '94%', height: '94%' }} />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {HIGHLIGHTS.map((item, i) => {
          const active = i === slideIdx;
          return (
            <Pressable
              key={item.title[0]}
              onPress={() => {
                playSound('tick', 0.45);
                setSlideIdx(i);
              }}
              style={{
                width: active ? 28 : 8,
                height: 8,
                borderRadius: 99,
                backgroundColor: active ? c.constant : c.thirdBg,
              }}
            />
          );
        })}
      </View>
    </View>
  );

  const featureList = (
    <AppCard variant="second_outlined" style={{ width: '100%', gap: 6, padding: 10 }}>
      {HIGHLIGHTS.map((item, i) => (
        <Pressable
          key={item.title[0]}
          onPress={() => {
            playSound('tick', 0.45);
            setSlideIdx(i);
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: layout.isDesktop ? 11 : 8,
            borderRadius: 12,
            backgroundColor: i === slideIdx ? hexToRgba(c.constant, 0.14) : 'transparent',
            borderWidth: 1,
            borderColor: i === slideIdx ? hexToRgba(c.constant, 0.35) : 'transparent',
          }}
        >
          <Ionicons
            name={item.icon}
            size={18}
            color={i === slideIdx ? c.constant : c.subText}
          />
          <View style={{ flex: 1 }}>
            <AppText size="sm" weight="bold">
              {l(...item.title)}
            </AppText>
            <AppText size="xsm" tone="sub" numberOfLines={layout.isDesktop ? 2 : 1}>
              {l(...item.subtitle)}
            </AppText>
          </View>
        </Pressable>
      ))}
    </AppCard>
  );

  const ctaStack = (
    <View style={{ gap: 10, marginTop: 6, width: '100%' }}>
      <AppButton
        title="Get Started — Meet Jymbo & Rank Up"
        size="lg"
        fullWidth
        onPress={() => {
          playSound('intro');
          navigation.navigate('OnboardingQuestionnaire');
        }}
        rightIcon={<Ionicons name="arrow-forward" size={18} color={c.constantText} />}
      />
      <AppButton
        title="I Already Have an Account"
        variant="secondary"
        fullWidth
        onPress={() => navigation.navigate('SignIn')}
      />
      {DEMO_AUTH_ENABLED ? (
        <AppButton
          title="Quick Demo Login (@alexlifts — Local Dev Demo)"
          variant="ghost"
          size="sm"
          fullWidth
          loading={demoSignIn.isPending}
          onPress={() =>
            demoSignIn.mutate({ identifier: 'demo@apexlift.app', password: 'demo1234' })
          }
        />
      ) : null}
    </View>
  );

  if (layout.isDesktop) {
    return (
      <ScreenContainer scroll contentStyle={{ paddingVertical: 28, justifyContent: 'space-between', gap: 28 }}>
        {brandHeader}

        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 36,
            paddingVertical: 16,
          }}
        >
          {/* Left Column: Editorial Headline, Interactive Feature Cards & CTAs */}
          <View style={{ flex: 1.1, gap: 18 }}>
            <View style={{ gap: 8 }}>
              <AppText size="xxsm" weight="xbold" tone="constant" style={{ letterSpacing: 1.4 }}>
                {l('SCIENCE-BACKED GAMIFIED PERFORMANCE', 'PERFORMANCE GAMIFIÉE & SCIENTIFIQUE', 'أداء علمي وتنافسي متكامل')}
              </AppText>
              <AppText size="xxl" weight="black" style={{ fontSize: 38, lineHeight: 44 }}>
                {l(...activeSlide.title)}
              </AppText>
              <AppText size="md" tone="sub" style={{ maxWidth: 540, lineHeight: 23 }}>
                {l(...activeSlide.subtitle)}
              </AppText>
            </View>

            {featureList}
            {ctaStack}
          </View>

          {/* Right Column: Sculpted Mascot & Rank Showcase Stage */}
          <AppCard
            glowColor={c.constant}
            style={{
              flex: 0.95,
              padding: 24,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {mascotShowcase}
          </AppCard>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll contentStyle={{ justifyContent: 'space-between', paddingVertical: 14 }}>
      {brandHeader}

      {/* Live Rive Jymbo Mascot + Speech Bubble */}
      <View style={{ alignItems: 'center', gap: 10, paddingTop: 6 }}>
        <TextBubbleSys value={l(...activeSlide.jymboLine)} tailPlacement="bottom" textAlign="center" />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <View style={{ opacity: 0.78, transform: [{ scale: 0.84 }] }}>
            <RankBadge tier="Elite" division={1} size={58} />
          </View>
          <JymboRive pose={activeSlide.pose} size={146} curlIntense={activeSlide.pose === 'Curling'} />
          <View style={{ opacity: 0.78, transform: [{ scale: 0.84 }] }}>
            <RankBadge tier={activeSlide.tier} division={1} size={64} showShine />
          </View>
        </View>

        <View style={{ gap: 6, alignItems: 'center', paddingHorizontal: 6, marginTop: 4 }}>
          <AppText size="xxl" weight="black" align="center">
            {l(...activeSlide.title)}
          </AppText>
          <AppText size="sm" tone="sub" align="center" style={{ maxWidth: 340 }}>
            {l(...activeSlide.subtitle)}
          </AppText>
        </View>

        {slideArt ? (
          <View
            style={{
              width: '100%',
              height: 112,
              borderRadius: RADII.card,
              overflow: 'hidden',
              backgroundColor: c.secondBg,
              borderWidth: 1,
              borderColor: hexToRgba(c.constant, 0.25),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image source={slideArt} resizeMode="contain" style={{ width: '94%', height: '94%' }} />
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {HIGHLIGHTS.map((item, i) => {
            const active = i === slideIdx;
            return (
              <Pressable
                key={item.title[0]}
                onPress={() => {
                  playSound('tick', 0.45);
                  setSlideIdx(i);
                }}
                style={{
                  width: active ? 28 : 8,
                  height: 8,
                  borderRadius: 99,
                  backgroundColor: active ? c.constant : c.thirdBg,
                }}
              />
            );
          })}
        </View>

        {featureList}
      </View>

      {ctaStack}
    </ScreenContainer>
  );
}
