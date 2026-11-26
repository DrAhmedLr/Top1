import React, { useState } from 'react';
import { Image, Linking, Platform, Pressable, Share, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { signOutAndRevokeSession, trpc } from '../../api/trpc';
import { getTop1ApiOrigin } from '../../api/top1Cloud';
import { getProfileBannerAsset } from '../../assets/assetRegistry';
import { ProfileQrCodeModal } from '../../components/social/ProfileQrCodeModal';
import {
  AppButton,
  AppCard,
  AppText,
  AvatarView,
  ScreenContainer,
  useAppAlert,
} from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { useLocale } from '../../i18n/LocaleProvider';
import { useWorkoutPhotosStore } from '../../stores/workoutPhotosStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useResponsiveLayout } from '../../theme/useResponsiveLayout';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import type { MainStackParamList } from '../../navigation/types';

export function ProfileTabScreen() {
  const { theme } = useTheme();
  const layout = useResponsiveLayout();
  const c = theme.colors;
  const { locale, setLocale, l } = useLocale();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { showAlert } = useAppAlert();
  const utils = trpc.useUtils();

  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const resetSession = useWorkoutStore((s) => s.resetSession);
  const clearPhotos = useWorkoutPhotosStore((s) => s.clearPhotos);
  const [qrOpen, setQrOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleSignOut = async () => {
    resetSession();
    clearPhotos();
    await signOutAndRevokeSession();
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const archive = await utils.user.exportData.fetch();
      const jsonText = JSON.stringify(archive, null, 2);
      if (Platform.OS === 'web' && typeof document !== 'undefined' && typeof Blob !== 'undefined') {
        const blob = new Blob([jsonText], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `TOP1-${user?.username ?? 'athlete'}-export.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        showAlert({
          title: 'Data Export Downloaded',
          message: 'Your complete TOP1% JSON archive has been saved to your device.',
        });
      } else {
        await Share.share({
          title: 'TOP1% Athlete Data Export',
          message: jsonText,
        });
      }
    } catch (err) {
      showAlert({
        title: 'Export Failed',
        message: err instanceof Error ? err.message : 'Unable to export account data right now.',
      });
    } finally {
      setExporting(false);
    }
  };

  const catalogQuery = trpc.shop.listCatalog.useQuery();
  const notifQuery = trpc.notifications.list.useQuery();
  const updateProfile = trpc.user.updateProfile.useMutation();

  const items = catalogQuery.data?.items ?? [];
  const equippedTitle = items.find((i) => i.id === user?.equippedTitleId);
  const equippedBorder = items.find((i) => i.id === user?.equippedBorderId);
  const bannerImg = getProfileBannerAsset(user?.equippedBannerId);
  const unreadCount = notifQuery.data?.unreadCount ?? 0;

  const menuRows: Array<{
    label: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    badge?: string;
    onPress: () => void;
  }> = [
    {
      label: 'Edit Profile & Units',
      subtitle: `${user?.unitWeight ?? 'lbs'} / ${user?.unitMeasure ?? 'in'} • ${user?.rankingSex ?? 'Male'}`,
      icon: 'person-circle-outline',
      onPress: () => navigation.navigate('EditProfile'),
    },
    {
      label: 'Avatar Studio (3D & Vector)',
      subtitle: 'Pick 3D presets or customize gear',
      icon: 'happy-outline',
      onPress: () => navigation.navigate('EditAvatar'),
    },
    {
      label: 'Cosmetics Shop & Locker',
      subtitle: `${user?.credits ?? 0} Credits • Animated borders & banners`,
      icon: 'storefront-outline',
      onPress: () => navigation.navigate('ShopAndInventory'),
    },
    {
      label: 'App Themes',
      subtitle: `Active: ${theme.name}`,
      icon: 'color-palette-outline',
      onPress: () => navigation.navigate('Themes'),
    },
    {
      label: 'Goals, Quests & Medals',
      subtitle: 'Track achievements & claim XP',
      icon: 'medal-outline',
      onPress: () => navigation.navigate('GoalsQuestsMedals', { initialTab: 'medals' }),
    },
    {
      label: 'Notifications Inbox',
      subtitle: unreadCount > 0 ? `${unreadCount} unread alerts` : 'All caught up',
      icon: 'notifications-outline',
      badge: unreadCount > 0 ? String(unreadCount) : undefined,
      onPress: () => navigation.navigate('NotificationCenter'),
    },
    {
      label: 'Share Profile QR & Public Card',
      subtitle: `top1.fit/share/${user?.username ?? 'athlete'}`,
      icon: 'qr-code-outline',
      onPress: () => setQrOpen(true),
    },
    {
      label: 'Feature Requests Roadmap',
      subtitle: 'Vote on upcoming TOP1% mobile & science features',
      icon: 'bulb-outline',
      onPress: () => navigation.navigate('FeatureRequests'),
    },
    {
      label: 'Notification Settings',
      subtitle: 'Workout reminders, social & announcements',
      icon: 'options-outline',
      onPress: () => navigation.navigate('NotificationSettings'),
    },
  ];

  return (
    <ScreenContainer scroll>
      <View
        style={
          layout.isDesktop
            ? { flexDirection: 'row', alignItems: 'flex-start', gap: 20 }
            : { gap: layout.sectionGap }
        }
      >
        <View style={layout.isDesktop ? { flex: 1, maxWidth: 430, gap: 14 } : { gap: layout.sectionGap }}>
      {/* Profile Hero Banner Card with Illustrated Banner + Animated Layered Border */}
      <AppCard padding={0} glowColor={equippedBorder?.previewValue || c.constant}>
        <View style={{ height: 112, width: '100%', overflow: 'hidden' }}>
          {bannerImg ? (
            <Image
              source={bannerImg}
              resizeMode="cover"
              style={{ position: 'absolute', width: '100%', height: '100%' }}
            />
          ) : null}
          <LinearGradient
            colors={['rgba(15,10,24,0.1)', 'rgba(15,10,24,0.85)']}
            style={{
              flex: 1,
              justifyContent: 'flex-start',
              alignItems: 'flex-end',
              padding: 12,
            }}
          >
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: RADII.pill,
                backgroundColor: 'rgba(15,10,24,0.75)',
                borderWidth: 1,
                borderColor: hexToRgba(c.constant, 0.45),
              }}
            >
              <AppText size="xsm" weight="xbold" tone="constant">
                LV {user?.level ?? 1} • {user?.experiencePoints ?? 0} XP
              </AppText>
            </View>
          </LinearGradient>
        </View>

        <View style={{ padding: 16, marginTop: -46, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <AvatarView
              config={user?.avatarConfig}
              borderId={user?.equippedBorderId || 'shp_border_sky'}
              presetKey={user?.rankingSex === 'Female' ? 'femalev31' : 'malev31'}
              size={76}
              borderColor={equippedBorder?.previewValue ?? c.constant}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <AppButton
                label="Avatar"
                size="sm"
                variant="secondary"
                onPress={() => navigation.navigate('EditAvatar')}
              />
              <AppButton
                label="Shop"
                size="sm"
                variant="gold"
                onPress={() => navigation.navigate('ShopAndInventory')}
              />
            </View>
          </View>

          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <AppText size="xl" weight="black">
                {user?.displayName ?? 'Athlete'}
              </AppText>
              {equippedTitle ? (
                <View
                  style={{
                    paddingHorizontal: 9,
                    paddingVertical: 3,
                    borderRadius: RADII.pill,
                    backgroundColor: hexToRgba(c.constant, 0.2),
                    borderWidth: 1,
                    borderColor: hexToRgba(c.constant, 0.4),
                  }}
                >
                  <AppText size="xsm" weight="bold" tone="constant">
                    {equippedTitle.name}
                  </AppText>
                </View>
              ) : null}
            </View>
            <AppText size="sm" tone="sub">
              @{user?.username} • {user?.overallTierLabel ?? user?.peakAverageRank ?? 'Unranked'}
              {user?.scientificModelScore ? ` • Model ${user.scientificModelScore}/100` : ''}
            </AppText>
            {user?.bio ? (
              <AppText size="sm" tone="default" style={{ marginTop: 4 }}>
                {user.bio}
              </AppText>
            ) : null}
          </View>

          <View style={{ gap: 5 }}>
            <View style={{ height: 7, borderRadius: 99, backgroundColor: c.thirdBg, overflow: 'hidden' }}>
              <View
                style={{
                  width: `${Math.max(8, Math.round((user?.levelProgress ?? 0.2) * 100))}%`,
                  height: '100%',
                  backgroundColor: c.constant,
                }}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText size="xsm" tone="sub">
                {user?.totalWorkouts ?? 0} workouts logged
              </AppText>
              <AppText size="xsm" weight="xbold" style={{ color: c.warning }}>
                {user?.credits ?? 0} Credits
              </AppText>
            </View>
          </View>
        </View>
      </AppCard>

      {/* Language Switcher (EN / FR / AR with RTL) */}
      <AppCard style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <AppText size="sm" weight="black">
              {l('Language & Layout', 'Langue & affichage', 'اللغة واتجاه الواجهة')}
            </AppText>
            <AppText size="xsm" tone="sub">
              {l('Instant EN / FR / AR translation with Arabic RTL', 'Traduction EN / FR / AR instantanée', 'ترجمة فورية مع دعم كامل للغة العربية')}
            </AppText>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(
            [
              { code: 'en', label: 'English' },
              { code: 'fr', label: 'Français' },
              { code: 'ar', label: 'العربية' },
            ] as const
          ).map((item) => {
            const active = locale === item.code;
            return (
              <Pressable
                key={item.code}
                onPress={() => {
                  void setLocale(item.code);
                  updateUser({ language: item.code });
                  updateProfile.mutate({ language: item.code });
                }}
                style={{
                  flex: 1,
                  paddingVertical: 9,
                  borderRadius: RADII.input,
                  alignItems: 'center',
                  backgroundColor: active ? hexToRgba(c.constant, 0.22) : c.thirdBg,
                  borderWidth: 1,
                  borderColor: active ? c.constant : 'transparent',
                }}
              >
                <AppText size="sm" weight="bold" tone={active ? 'constant' : 'default'}>
                  {item.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </AppCard>

      {layout.isDesktop ? (
        <AppButton
          label="Sign Out"
          variant="danger"
          onPress={() =>
            showAlert({
              title: 'Sign out of TOP1%?',
              message: 'Your data stays safely synced to your account.',
              actions: [
                { label: 'Cancel', variant: 'secondary' },
                {
                  label: 'Sign Out',
                  variant: 'danger',
                  onPress: handleSignOut,
                },
              ],
            })
          }
          fullWidth
        />
      ) : null}
        </View>

        <View style={layout.isDesktop ? { flex: 1.35, gap: 14 } : { gap: layout.sectionGap }}>
      {/* Menu List — 2-Column Grid on Desktop, Vertical List on Mobile */}
      <View
        style={
          layout.isDesktop
            ? { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }
            : { gap: 8 }
        }
      >
        {menuRows.map((row) => (
          <Pressable
            key={row.label}
            onPress={row.onPress}
            style={layout.isDesktop ? { flexBasis: '48.5%', flexGrow: 1, minWidth: 260 } : undefined}
          >
            <AppCard
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 13,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  backgroundColor: c.thirdBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={row.icon} size={20} color={c.constant} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText size="sm" weight="bold">
                  {row.label}
                </AppText>
                <AppText size="xsm" tone="sub">
                  {row.subtitle}
                </AppText>
              </View>
              {row.badge ? (
                <View
                  style={{
                    minWidth: 22,
                    height: 22,
                    borderRadius: 99,
                    backgroundColor: c.danger,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 6,
                  }}
                >
                  <AppText size="xsm" weight="bold" style={{ color: '#FFFFFF' }}>
                    {row.badge}
                  </AppText>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={18} color={c.subText} />
            </AppCard>
          </Pressable>
        ))}
      </View>

      {/* Privacy, Data Control & Legal */}
      <AppCard style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <AppText size="xxsm" weight="xbold" tone="constant">
              DATA OWNERSHIP &amp; TRANSPARENCY
            </AppText>
            <AppText size="sm" weight="black">
              Export Your Data, Methodology &amp; Privacy
            </AppText>
          </View>
        </View>

        <AppButton
          label="Download My Data (JSON)"
          size="sm"
          variant="secondary"
          loading={exporting}
          onPress={() => void handleExportData()}
          fullWidth
        />

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <AppButton
            label="Methodology & About"
            size="sm"
            variant="ghost"
            onPress={() => void Linking.openURL(`${getTop1ApiOrigin()}/about`)}
            style={{ flex: 1 }}
          />
          <AppButton
            label="Privacy Policy"
            size="sm"
            variant="ghost"
            onPress={() => void Linking.openURL(`${getTop1ApiOrigin()}/privacy`)}
            style={{ flex: 1 }}
          />
        </View>
      </AppCard>

      <ProfileQrCodeModal
        visible={qrOpen}
        onClose={() => setQrOpen(false)}
        username={user?.username ?? 'athlete'}
        displayName={user?.displayName ?? 'TOP1% Athlete'}
        standingLabel={user?.overallTierLabel ?? user?.peakAverageRank ?? 'TOP1% Contender'}
        referralCode={user?.referralCode}
      />

      {!layout.isDesktop ? (
      <AppButton
        label="Sign Out"
        variant="danger"
        onPress={() =>
          showAlert({
            title: 'Sign out of TOP1%?',
            message: 'Your data stays safely synced to your account.',
            actions: [
              { label: 'Cancel', variant: 'secondary' },
              {
                label: 'Sign Out',
                variant: 'danger',
                onPress: handleSignOut,
              },
            ],
          })
        }
        fullWidth
      />
      ) : null}
        </View>
      </View>
    </ScreenContainer>
  );
}
