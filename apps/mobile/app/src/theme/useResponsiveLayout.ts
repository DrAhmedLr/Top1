import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ResponsiveLayout {
  width: number;
  height: number;
  /** True on compact phones (< 375px wide, e.g. iPhone SE / small Android). */
  isCompact: boolean;
  /** True on tablets and wide web layouts (>= 640px). */
  isWide: boolean;
  /** True on large desktop web (>= 1024px). */
  isDesktop: boolean;
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
  /** Readable content container max-width when in wide/tablet mode. */
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
    const isWide = width >= 640;
    const isDesktop = width >= 1024;
    const gutter = isCompact ? 12 : isWide ? 22 : 16;
    const cardPad = isCompact ? 12 : isWide ? 18 : 15;
    const sectionGap = isCompact ? 12 : isWide ? 16 : 14;
    const gridColumns: 2 | 3 | 4 = isDesktop ? 4 : isWide ? 3 : 2;
    const bodygraphHeight = Math.round(
      Math.min(230, Math.max(144, (isWide ? 440 : width) * 0.44)),
    );
    const fontScale = isCompact ? 0.94 : Platform.OS === 'web' && isWide ? 1.02 : 1;

    return {
      width,
      height,
      isCompact,
      isWide,
      isDesktop,
      gutter,
      cardPad,
      sectionGap,
      gridColumns,
      bodygraphHeight,
      maxContentWidth: 920,
      insets,
      fontScale,
    };
  }, [width, height, insets]);
}
