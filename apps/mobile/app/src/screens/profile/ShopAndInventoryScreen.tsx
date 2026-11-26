import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../api/trpc';
import { getProfileBannerAsset } from '../../assets/assetRegistry';
import { ONBOARDING_ASSETS } from '../../assets/v3AssetRegistry';
import { ConfettiOverlay } from '../../components/fx';
import { JymboRive } from '../../components/mascot';
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
import { impactMedium, notifySuccess } from '../../utils/haptics';
import { playSound, startMusicLoop, stopMusicLoop } from '../../utils/soundscape';

export function ShopAndInventoryScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { showAlert } = useAppAlert();
  const utils = trpc.useUtils();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [category, setCategory] = useState<'title' | 'border' | 'banner'>('border');
  const [dealSeed, setDealSeed] = useState(0);
  const [unlockBurst, setUnlockBurst] = useState(0);
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const catalogQuery = trpc.shop.listCatalog.useQuery();

  useEffect(() => {
    if (bgmPlaying) {
      startMusicLoop('egg_shop');
    } else {
      stopMusicLoop();
    }
    return () => stopMusicLoop();
  }, [bgmPlaying]);

  const refreshMe = async () => {
    try {
      const fresh = await utils.user.me.fetch();
      setUser(fresh);
    } catch {
      // ignore
    }
  };

  const purchase = trpc.shop.purchase.useMutation({
    onSuccess: async () => {
      notifySuccess();
      playSound('eggs_burst');
      setTimeout(() => playSound('challenge_claim'), 220);
      setUnlockBurst((b) => b + 1);
      utils.shop.listCatalog.invalidate();
      await refreshMe();
      showAlert({ title: 'Unlocked!', message: 'Item added to your locker.' });
    },
    onError: (err) => showAlert({ title: 'Purchase failed', message: err.message }),
  });

  const equip = trpc.shop.equip.useMutation({
    onSuccess: async () => {
      impactMedium();
      playSound('stat_card_2');
      await refreshMe();
      showAlert({ title: 'Equipped!', message: 'Your profile showcase has been updated.' });
    },
  });

  const credits = catalogQuery.data?.credits ?? user?.credits ?? 0;
  const allItems = catalogQuery.data?.items ?? [];
  const items = allItems.filter((i) => i.category === category);
  const dailyDeal = useMemo(() => {
    const unowned = allItems.filter((i) => !i.owned);
    const pool = unowned.length > 0 ? unowned : allItems;
    if (pool.length === 0) return null;
    return pool[dealSeed % pool.length];
  }, [allItems, dealSeed]);
  const eggImg = ONBOARDING_ASSETS.item_eggs;

  const equippedId =
    category === 'title'
      ? user?.equippedTitleId
      : category === 'border'
        ? user?.equippedBorderId
        : user?.equippedBannerId;

  return (
    <ScreenContainer scroll>
      <StackHeader
        title="Cosmetics Shop"
        subtitle={`Available balance: ${credits} Credits`}
      />

      <ConfettiOverlay visible={unlockBurst > 0} burstKey={unlockBurst} count={28} />

      <AppCard
        glowColor={c.warning}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {eggImg ? <Image source={eggImg} style={{ width: 42, height: 42 }} resizeMode="contain" /> : null}
          <View>
            <AppText size="xsm" tone="sub">
              CREDITS VAULT
            </AppText>
            <AppText size="xxl" weight="black" style={{ color: c.warning }} tabular>
              {credits} Credits
            </AppText>
          </View>
        </View>
        <Pressable
          onPress={() => setBgmPlaying((p) => !p)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 10,
            paddingVertical: 7,
            borderRadius: 99,
            backgroundColor: c.thirdBg,
          }}
        >
          <Ionicons
            name={bgmPlaying ? 'musical-notes' : 'musical-notes-outline'}
            size={15}
            color={bgmPlaying ? '#FFE066' : c.subText}
          />
          <AppText size="xxsm" weight="bold" tone={bgmPlaying ? 'default' : 'sub'}>
            {bgmPlaying ? 'Shop BGM On' : 'Play BGM'}
          </AppText>
        </Pressable>
      </AppCard>

      {/* Featured Cosmetic Spotlight */}
      {dailyDeal ? (
        <AppCard
          variant="gradient"
          glowColor="#FFE066"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}
        >
          <JymboRive pose="Cool" size={72} showShadow={false} />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppText size="xxsm" weight="black" style={{ color: '#FFE066', letterSpacing: 1 }}>
                FEATURED SPOTLIGHT
              </AppText>
            </View>
            <AppText size="md" weight="black">
              {dailyDeal.name}
            </AppText>
            <AppText size="xsm" tone="sub">
              {dailyDeal.rarity.toUpperCase()} {dailyDeal.category} • {dailyDeal.costCredits} Credits
            </AppText>
          </View>
          <View style={{ gap: 6 }}>
            {!dailyDeal.owned ? (
              <AppButton
                label="Unlock"
                variant="gold"
                size="sm"
                loading={purchase.isPending}
                onPress={() => purchase.mutate({ itemId: dailyDeal.id })}
              />
            ) : null}
            <AppButton
              label="Next Pick"
              variant="secondary"
              size="sm"
              onPress={() => {
                playSound('tick');
                setDealSeed((s) => s + 1);
              }}
            />
          </View>
        </AppCard>
      ) : null}

      <SegmentedControl
        value={category}
        onChange={setCategory}
        options={[
          { label: 'Borders', value: 'border' },
          { label: 'Banners', value: 'banner' },
          { label: 'Titles', value: 'title' },
        ]}
      />

      <View style={{ gap: 12 }}>
        {items.map((item) => {
          const isEquipped = equippedId === item.id;
          const bannerPreview = category === 'banner' ? getProfileBannerAsset(item.id) : null;

          return (
            <AppCard
              key={item.id}
              glowColor={isEquipped ? c.constant : undefined}
              style={{ gap: 10 }}
            >
              {bannerPreview ? (
                <Image
                  source={bannerPreview}
                  resizeMode="cover"
                  style={{ width: '100%', height: 76, borderRadius: 12 }}
                />
              ) : null}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {category === 'border' ? (
                  <AvatarView
                    config={user?.avatarConfig}
                    borderId={item.id}
                    presetKey={user?.rankingSex === 'Female' ? 'femalev31' : 'malev31'}
                    size={46}
                  />
                ) : category === 'title' ? (
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderRadius: RADII.input,
                      backgroundColor: hexToRgba(c.constant, 0.16),
                      borderWidth: 1,
                      borderColor: hexToRgba(c.constant, 0.4),
                    }}
                  >
                    <AppText size="xsm" weight="xbold" tone="constant">
                      TITLE
                    </AppText>
                  </View>
                ) : null}

                <View style={{ flex: 1, gap: 2 }}>
                  <AppText size="md" weight="xbold">
                    {item.name}
                  </AppText>
                  <AppText size="xsm" tone="sub">
                    {item.rarity.toUpperCase()} •{' '}
                    {item.owned ? 'Owned' : `${item.costCredits} Credits`}
                  </AppText>
                </View>

                {isEquipped ? (
                  <AppText size="xsm" weight="xbold" tone="check">
                    Equipped
                  </AppText>
                ) : item.owned ? (
                  <AppButton
                    label="Equip"
                    size="sm"
                    variant="secondary"
                    loading={equip.isPending}
                    onPress={() => equip.mutate({ category, value: item.id })}
                  />
                ) : (
                  <AppButton
                    label={`Buy ${item.costCredits}`}
                    size="sm"
                    variant="gold"
                    loading={purchase.isPending}
                    onPress={() => purchase.mutate({ itemId: item.id })}
                  />
                )}
              </View>
            </AppCard>
          );
        })}
      </View>
    </ScreenContainer>
  );
}
