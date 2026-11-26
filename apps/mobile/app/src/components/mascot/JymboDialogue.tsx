import React, { useEffect, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { JymboRive, type JymboPose } from './JymboRive';
import { TextBubbleSys } from './TextBubbleSys';

export interface JymboDialogueProps {
  mascotText: string;
  mascotPose?: JymboPose;
  mascotSize?: number;
  ltr?: boolean;
  premium?: boolean;
  curlIntense?: boolean;
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Exact Jymbo + Speech Bubble dialogue header modeled on mod_10113_JymboDialogue.js
 */
export function JymboDialogue({
  mascotText,
  mascotPose = 'Notes',
  mascotSize = 96,
  ltr = true,
  premium = false,
  curlIntense = false,
  animated = true,
  style,
}: JymboDialogueProps) {
  const [noteTriggerKey, setNoteTriggerKey] = useState(0);

  useEffect(() => {
    if (mascotPose === 'Notes') {
      setNoteTriggerKey((k) => k + 1);
    }
  }, [mascotText, mascotPose]);

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          width: '100%',
          gap: 10,
        },
        style,
      ]}
    >
      {ltr ? (
        <JymboRive
          pose={mascotPose}
          size={mascotSize}
          premium={premium}
          curlIntense={curlIntense}
          noteTriggerKey={noteTriggerKey}
          showShadow
        />
      ) : null}

      <View style={{ flex: 1 }}>
        <TextBubbleSys
          value={mascotText}
          tailPlacement={ltr ? 'left' : 'right'}
          animated={animated}
        />
      </View>

      {!ltr ? (
        <JymboRive
          pose={mascotPose}
          size={mascotSize}
          premium={premium}
          curlIntense={curlIntense}
          noteTriggerKey={noteTriggerKey}
          showShadow
        />
      ) : null}
    </View>
  );
}
