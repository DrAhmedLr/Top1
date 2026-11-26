import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../api/trpc';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import { AppButton, AppInput, AppModal, AppText } from '../ui';

const QUICK_TEST_BARCODES = [
  { code: '0011110000011', label: 'Chicken Breast' },
  { code: '0011110000042', label: 'Whey Isolate' },
  { code: '0011110000059', label: 'Greek Yogurt' },
];

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  dateIso: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export function BarcodeScannerModal({
  visible,
  onClose,
  dateIso,
  mealType,
}: BarcodeScannerModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const utils = trpc.useUtils();

  const [barcode, setBarcode] = useState('');
  const [queriedCode, setQueriedCode] = useState('');

  const lookupQuery = trpc.food.byBarcode.useQuery(
    { barcode: queriedCode },
    { enabled: queriedCode.length >= 4 }
  );

  const logFood = trpc.food.logFood.useMutation({
    onSuccess: () => {
      utils.food.getLogsByDate.invalidate({ dateIso });
      setBarcode('');
      setQueriedCode('');
      onClose();
    },
  });

  const found = lookupQuery.data;

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      title="Barcode Scanner"
      subtitle="Scan or enter a UPC barcode to log macros instantly"
    >
      {/* Clean-room Camera Viewfinder Placeholder */}
      <View
        style={{
          height: 110,
          borderRadius: RADII.card,
          backgroundColor: c.thirdBg,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: c.constant,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <Ionicons name="barcode-outline" size={38} color={c.constant} />
        <AppText size="xsm" tone="sub">
          Enter UPC manually or tap a sample barcode below
        </AppText>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <AppInput
          label="UPC Barcode"
          placeholder="0011110000011"
          keyboardType="number-pad"
          value={barcode}
          onChangeText={setBarcode}
          containerStyle={{ flex: 1 }}
        />
        <AppButton
          label="Lookup"
          size="sm"
          onPress={() => setQueriedCode(barcode.trim())}
          style={{ height: 48 }}
        />
      </View>

      {/* Quick Test Chips */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {QUICK_TEST_BARCODES.map((b) => (
          <Pressable
            key={b.code}
            onPress={() => {
              setBarcode(b.code);
              setQueriedCode(b.code);
            }}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: RADII.pill,
              backgroundColor: hexToRgba(c.constant, 0.14),
            }}
          >
            <AppText size="xsm" weight="bold" tone="constant">
              {b.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      {/* Match Result */}
      {found ? (
        <View
          style={{
            padding: 12,
            borderRadius: RADII.card,
            backgroundColor: c.thirdBg,
            gap: 8,
          }}
        >
          <AppText size="md" weight="bold">
            {found.name}
          </AppText>
          <AppText size="xsm" tone="sub">
            {found.brand} • {found.servingSize}
            {found.servingUnit} • {found.calories} kcal (P {found.proteinG}g / C {found.carbsG}g / F{' '}
            {found.fatG}g)
          </AppText>
          <AppButton
            label={`Log to ${mealType}`}
            size="sm"
            loading={logFood.isPending}
            onPress={() =>
              logFood.mutate({
                dateIso,
                mealType,
                foodId: found.id,
                foodName: found.name,
                servings: 1,
                calories: found.calories,
                proteinG: found.proteinG,
                carbsG: found.carbsG,
                fatG: found.fatG,
              })
            }
          />
        </View>
      ) : queriedCode.length >= 4 && !lookupQuery.isFetching ? (
        <AppText size="sm" tone="danger" align="center">
          No food found for barcode {queriedCode}.
        </AppText>
      ) : null}
    </AppModal>
  );
}
