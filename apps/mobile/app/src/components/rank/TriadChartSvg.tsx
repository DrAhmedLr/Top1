import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { AppText } from '../ui';
import { useTheme } from '../../theme/ThemeProvider';

export interface TriadChartProps {
  /** Pillar scores on 0-100 scale (or null if unmeasured). */
  strength: number | null;
  bodymarkers: number | null;
  recovery: number | null;
  size?: number;
  labels?: [string, string, string];
}

/**
 * Native SVG 3-Pillar Scientific Triad Radar Chart (ported from Top1.Fit TriadChart).
 * Vertices: Top = Strength & Engine (45%), Bottom-Right = Body & Markers (40%), Bottom-Left = Recovery (15%).
 */
export function TriadChartSvg({
  strength,
  bodymarkers,
  recovery,
  size = 210,
  labels = ['Strength 45%', 'Markers 40%', 'Recovery 15%'],
}: TriadChartProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const cx = size / 2;
  const cy = size / 2 + 8;
  const radius = size * 0.34;

  const angles = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
  const pointAt = (angle: number, pct: number) => {
    const r = (Math.max(8, Math.min(100, pct)) / 100) * radius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const vals = [strength ?? 15, bodymarkers ?? 15, recovery ?? 15];
  const dataPoints = vals
    .map((v, idx) => {
      const p = pointAt(angles[idx], v);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');

  const rings = [25, 50, 75, 100];
  const vertexColors = ['#F97316', '#38BDF8', '#22C55E'];

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        {/* Concentric triangular rings */}
        {rings.map((ring) => {
          const pts = angles
            .map((a) => {
              const p = pointAt(a, ring);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(' ');
          return (
            <Polygon
              key={ring}
              points={pts}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1}
              strokeDasharray={ring === 100 ? undefined : '3,3'}
            />
          );
        })}

        {/* Axis spokes */}
        {angles.map((a, idx) => {
          const outer = pointAt(a, 100);
          return (
            <Line
              key={idx}
              x1={cx}
              y1={cy}
              x2={outer.x}
              y2={outer.y}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
            />
          );
        })}

        {/* Athlete filled triad */}
        <Polygon
          points={dataPoints}
          fill="rgba(56, 189, 248, 0.24)"
          stroke={c.constant}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />

        {/* Vertex dots */}
        {vals.map((v, idx) => {
          const p = pointAt(angles[idx], v);
          return (
            <Circle
              key={idx}
              cx={p.x}
              cy={p.y}
              r={5}
              fill={vertexColors[idx]}
              stroke="#0F0A18"
              strokeWidth={2}
            />
          );
        })}

        {/* Labels */}
        <SvgText x={cx} y={18} fill={c.text} fontSize={11} fontWeight="700" textAnchor="middle">
          {labels[0]}
        </SvgText>
        <SvgText
          x={size - 10}
          y={size - 12}
          fill={c.text}
          fontSize={10.5}
          fontWeight="700"
          textAnchor="end"
        >
          {labels[1]}
        </SvgText>
        <SvgText
          x={10}
          y={size - 12}
          fill={c.text}
          fontSize={10.5}
          fontWeight="700"
          textAnchor="start"
        >
          {labels[2]}
        </SvgText>
      </Svg>
      <AppText size="xxsm" tone="sub" style={{ marginTop: -4 }}>
        Strength {strength ?? '—'} · Markers {bodymarkers ?? '—'} · Recovery {recovery ?? '—'}
      </AppText>
    </View>
  );
}
