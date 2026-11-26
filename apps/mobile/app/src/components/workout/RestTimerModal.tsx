import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatDuration } from '@apexlift/shared';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import { AppButton, AppModal, AppText, ProgressRing } from '../ui';

const PRESET_SECONDS = [30, 60, 90, 120, 180, 240];

interface RestTimerModalProps {
  visible: boolean;
  onClose: () => void;
}

export function RestTimerModal({ visible, onClose }: RestTimerModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const restTimerEndAt = useWorkoutStore((s) => s.restTimerEndAt);
  const restTimerDurationSec = useWorkoutStore((s) => s.restTimerDurationSec);
  const startRestTimer = useWorkoutStore((s) => s.startRestTimer);
  const adjustRestTimer = useWorkoutStore((s) => s.adjustRestTimer);
  const clearRestTimer = useWorkoutStore((s) => s.clearRestTimer);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [visible]);

  const remainingSec = restTimerEndAt ? Math.max(0, Math.ceil((restTimerEndAt - now) / 1000)) : 0;
  const progress =
    restTimerEndAt && restTimerDurationSec > 0
      ? Math.max(0, Math.min(1, remainingSec / restTimerDurationSec))
      : 0;

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      title="Rest Timer"
      subtitle={remainingSec > 0 ? 'Recover & lock in for the next set' : 'Pick a rest duration'}
    >
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <ProgressRing
          size={150}
          strokeWidth={12}
          progress={progress}
          color={remainingSec === 0 && restTimerEndAt ? c.check : c.constant}
          centerText={formatDuration(remainingSec)}
          centerSubText={remainingSec > 0 ? 'REMAINING' : 'READY'}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <AppButton
          label="-15s"
          variant="secondary"
          size="sm"
          onPress={() => adjustRestTimer(-15)}
          style={{ flex: 1 }}
        />
        <AppButton
          label="+15s"
          variant="secondary"
          size="sm"
          onPress={() => adjustRestTimer(15)}
          style={{ flex: 1 }}
        />
        <AppButton
          label="Skip"
          variant="ghost"
          size="sm"
          onPress={() => {
            clearRestTimer();
            onClose();
          }}
          style={{ flex: 1 }}
        />
      </View>

      <View style={{ gap: 8 }}>
        <AppText size="xsm" weight="bold" tone="sub">
          QUICK PRESETS
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PRESET_SECONDS.map((sec) => {
            const active = restTimerDurationSec === sec && remainingSec > 0;
            return (
              <Pressable
                key={sec}
                onPress={() => startRestTimer(sec)}
                style={{
                  width: '30%',
                  paddingVertical: 10,
                  borderRadius: RADII.input,
                  alignItems: 'center',
                  backgroundColor: active ? hexToRgba(c.constant, 0.2) : c.thirdBg,
                  borderWidth: 1,
                  borderColor: active ? c.constant : 'transparent',
                }}
              >
                <AppText size="sm" weight="bold" tone={active ? 'constant' : 'default'}>
                  {formatDuration(sec)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <AppButton label="Done" onPress={onClose} fullWidth />
    </AppModal>
  );
}
