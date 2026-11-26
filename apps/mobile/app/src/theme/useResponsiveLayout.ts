import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ResponsiveLayout {
  width: number;
  height: number;
  /** True on compact phones (< 375px wide, e.g. iPhone SE / small Android). */
  isCompact: boolean;
  /** True on tablets and wide web layouts (>= 680px). */
  isWide: boolean;
  /** True on desktop web/tablet landscape where the left sidebar rail activates (>= 960px). */
  isDesktop: boolean;
  /** True on large widescreen desktop displays (>= 1280px). */
  isLargeDesktop: boolean;
  /** Adaptive horizontal screen padding. */
  gutter: number;
  /** Adaptive interior card padding. */
  cardPad: number;
  /** Adaptive vertical spacing between cards/sections. */
  sectionGap: number;
  /** Recommended tile columns for feature/metric grids. */
  gridColumns: 2 | 3 | 4;
  /** Responsive SVG bodygraph height that fits comfortably on any viewport. */
  bodygraphHeight: number;
  /** Readable content container max-width when in wide/desktop mode. */
  maxContentWidth: number;
  /** Safe area insets. */
  insets: { top: number; bottom: number; left: number; right: number };
  /** Font scale multiplier (slightly tighter on 320-360px, crisp on larger displays). */
  fontScale: number;
}

export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    const isCompact = width < 375;
    const isWide = width >= 680;
    const isDesktop = width >= 960;
    const isLargeDesktop = width >= 1280;
    const gutter = isCompact ? 12 : isDesktop ? 28 : isWide ? 22 : 16;
    const cardPad = isCompact ? 12 : isDesktop ? 20 : isWide ? 18 : 15;
    const sectionGap = isCompact ? 12 : isDesktop ? 20 : isWide ? 16 : 14;
    const gridColumns: 2 | 3 | 4 = isDesktop ? 4 : isWide ? 3 : 2;
    const bodygraphHeight = Math.round(
      isDesktop ? 248 : Math.min(230, Math.max(150, (isWide ? 440 : width) * 0.44)),
    );
    const fontScale = isCompact ? 0.94 : Platform.OS === 'web' && isWide ? 1.02 : 1;

    return {
      width,
      height,
      isCompact,
      isWide,
      isDesktop,
      isLargeDesktop,
      gutter,
      cardPad,
      sectionGap,
      gridColumns,
      bodygraphHeight,
      maxContentWidth: isDesktop ? 1240 : 920,
      insets,
      fontScale,
    };
  }, [width, height, insets]);
}
