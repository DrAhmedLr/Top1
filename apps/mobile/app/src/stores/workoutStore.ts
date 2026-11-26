import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type WorkoutSetType = 'normal' | 'warmup' | 'drop' | 'failure';

export interface ActiveWorkoutSet {
  id: string;
  setType: WorkoutSetType;
  weightKg: number;
  reps: number;
  rpe: number | null;
  rir: number | null;
  isCompleted: boolean;
}

export interface ActiveWorkoutExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  equipment: string;
  primaryMuscles: string[];
  maleBaseFactor?: number;
  femaleBaseFactor?: number;
  includesBodyweight?: boolean;
  supersetGroup: string | null;
  restSeconds: number;
  notes: string;
  sets: ActiveWorkoutSet[];
}

export interface ActiveWorkoutSession {
  title: string;
  presetId: string | null;
  startedAt: number;
  exercises: ActiveWorkoutExercise[];
}

export interface StartPresetInput {
  id?: string | null;
  name: string;
  exercises: Array<{
    exerciseId: string;
    exerciseName: string;
    equipment: string;
    primaryMuscles: string[];
    maleBaseFactor?: number;
    femaleBaseFactor?: number;
    includesBodyweight?: boolean;
    supersetGroup?: string | null;
    restSeconds?: number;
    notes?: string;
    targetSets: Array<{
      weightKg: number;
      reps: number;
      setType?: WorkoutSetType;
    }>;
  }>;
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

interface WorkoutStoreState {
  session: ActiveWorkoutSession | null;
  isSheetOpen: boolean;
  restTimerEndAt: number | null;
  restTimerDurationSec: number;
  openSheet: () => void;
  closeSheet: () => void;
  startEmpty: (title?: string) => void;
  startFromPreset: (preset: StartPresetInput) => void;
  setTitle: (title: string) => void;
  addExercise: (ex: {
    exerciseId: string;
    exerciseName: string;
    equipment: string;
    primaryMuscles: string[];
    maleBaseFactor?: number;
    femaleBaseFactor?: number;
    includesBodyweight?: boolean;
    defaultWeightKg?: number;
    defaultReps?: number;
  }) => void;
  removeExercise: (localExId: string) => void;
  moveExercise: (localExId: string, dir: -1 | 1) => void;
  setExerciseSuperset: (localExId: string, group: string | null) => void;
  setExerciseNotes: (localExId: string, notes: string) => void;
  setExerciseRestSeconds: (localExId: string, seconds: number) => void;
  addSet: (localExId: string) => void;
  updateSet: (localExId: string, setId: string, patch: Partial<ActiveWorkoutSet>) => void;
  toggleSetComplete: (localExId: string, setId: string) => void;
  deleteSet: (localExId: string, setId: string) => void;
  startRestTimer: (seconds: number) => void;
  adjustRestTimer: (deltaSeconds: number) => void;
  clearRestTimer: () => void;
  resetSession: () => void;
}

export const useWorkoutStore = create<WorkoutStoreState>()(
  persist(
    (set, get) => ({
      session: null,
      isSheetOpen: false,
      restTimerEndAt: null,
      restTimerDurationSec: 90,

      openSheet: () => set({ isSheetOpen: true }),
      closeSheet: () => set({ isSheetOpen: false }),

      startEmpty: (title = 'Freestyle Workout') =>
        set({
          session: {
            title,
            presetId: null,
            startedAt: Date.now(),
            exercises: [],
          },
          isSheetOpen: true,
          restTimerEndAt: null,
        }),

      startFromPreset: (preset) =>
        set({
          session: {
            title: preset.name,
            presetId: preset.id ?? null,
            startedAt: Date.now(),
            exercises: preset.exercises.map((ex) => ({
              id: uid('wex'),
              exerciseId: ex.exerciseId,
              exerciseName: ex.exerciseName,
              equipment: ex.equipment,
              primaryMuscles: ex.primaryMuscles,
              maleBaseFactor: ex.maleBaseFactor,
              femaleBaseFactor: ex.femaleBaseFactor,
              includesBodyweight: ex.includesBodyweight,
              supersetGroup: ex.supersetGroup ?? null,
              restSeconds: ex.restSeconds ?? 90,
              notes: ex.notes ?? '',
              sets: (ex.targetSets.length > 0
                ? ex.targetSets
                : [{ weightKg: 40, reps: 10, setType: 'normal' as const }]
              ).map((s) => ({
                id: uid('set'),
                setType: s.setType ?? 'normal',
                weightKg: s.weightKg,
                reps: s.reps,
                rpe: null,
                rir: null,
                isCompleted: false,
              })),
            })),
          },
          isSheetOpen: true,
          restTimerEndAt: null,
        }),

      setTitle: (title) =>
        set((s) => (s.session ? { session: { ...s.session, title } } : s)),

      addExercise: (ex) =>
        set((s) => {
          const base = s.session ?? {
            title: 'Freestyle Workout',
            presetId: null,
            startedAt: Date.now(),
            exercises: [],
          };
          const newEx: ActiveWorkoutExercise = {
            id: uid('wex'),
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            equipment: ex.equipment,
            primaryMuscles: ex.primaryMuscles,
            maleBaseFactor: ex.maleBaseFactor,
            femaleBaseFactor: ex.femaleBaseFactor,
            includesBodyweight: ex.includesBodyweight,
            supersetGroup: null,
            restSeconds: 90,
            notes: '',
            sets: [
              {
                id: uid('set'),
                setType: 'normal',
                weightKg: ex.defaultWeightKg ?? 40,
                reps: ex.defaultReps ?? 8,
                rpe: null,
                rir: null,
                isCompleted: false,
              },
            ],
          };
          return {
            session: { ...base, exercises: [...base.exercises, newEx] },
          };
        }),

      removeExercise: (localExId) =>
        set((s) => {
          if (!s.session) return s;
          return {
            session: {
              ...s.session,
              exercises: s.session.exercises.filter((e) => e.id !== localExId),
            },
          };
        }),

      moveExercise: (localExId, dir) =>
        set((s) => {
          if (!s.session) return s;
          const arr = [...s.session.exercises];
          const idx = arr.findIndex((e) => e.id === localExId);
          const target = idx + dir;
          if (idx < 0 || target < 0 || target >= arr.length) return s;
          [arr[idx], arr[target]] = [arr[target], arr[idx]];
          return { session: { ...s.session, exercises: arr } };
        }),

      setExerciseSuperset: (localExId, group) =>
        set((s) => {
          if (!s.session) return s;
          return {
            session: {
              ...s.session,
              exercises: s.session.exercises.map((e) =>
                e.id === localExId ? { ...e, supersetGroup: group } : e
              ),
            },
          };
        }),

      setExerciseNotes: (localExId, notes) =>
        set((s) => {
          if (!s.session) return s;
          return {
            session: {
              ...s.session,
              exercises: s.session.exercises.map((e) =>
                e.id === localExId ? { ...e, notes } : e
              ),
            },
          };
        }),

      setExerciseRestSeconds: (localExId, seconds) =>
        set((s) => {
          if (!s.session) return s;
          return {
            session: {
              ...s.session,
              exercises: s.session.exercises.map((e) =>
                e.id === localExId ? { ...e, restSeconds: seconds } : e
              ),
            },
          };
        }),

      addSet: (localExId) =>
        set((s) => {
          if (!s.session) return s;
          return {
            session: {
              ...s.session,
              exercises: s.session.exercises.map((e) => {
                if (e.id !== localExId) return e;
                const last = e.sets[e.sets.length - 1];
                return {
                  ...e,
                  sets: [
                    ...e.sets,
                    {
                      id: uid('set'),
                      setType: 'normal',
                      weightKg: last?.weightKg ?? 40,
                      reps: last?.reps ?? 8,
                      rpe: null,
                      rir: null,
                      isCompleted: false,
                    },
                  ],
                };
              }),
            },
          };
        }),

      updateSet: (localExId, setId, patch) =>
        set((s) => {
          if (!s.session) return s;
          return {
            session: {
              ...s.session,
              exercises: s.session.exercises.map((e) =>
                e.id === localExId
                  ? {
                      ...e,
                      sets: e.sets.map((st) => (st.id === setId ? { ...st, ...patch } : st)),
                    }
                  : e
              ),
            },
          };
        }),

      toggleSetComplete: (localExId, setId) => {
        const cur = get().session;
        if (!cur) return;
        const ex = cur.exercises.find((e) => e.id === localExId);
        const st = ex?.sets.find((x) => x.id === setId);
        const nextCompleted = !(st?.isCompleted ?? false);
        set({
          session: {
            ...cur,
            exercises: cur.exercises.map((e) =>
              e.id === localExId
                ? {
                    ...e,
                    sets: e.sets.map((x) =>
                      x.id === setId ? { ...x, isCompleted: nextCompleted } : x
                    ),
                  }
                : e
            ),
          },
          ...(nextCompleted && ex
            ? {
                restTimerDurationSec: ex.restSeconds || 90,
                restTimerEndAt: Date.now() + (ex.restSeconds || 90) * 1000,
              }
            : {}),
        });
      },

      deleteSet: (localExId, setId) =>
        set((s) => {
          if (!s.session) return s;
          return {
            session: {
              ...s.session,
              exercises: s.session.exercises.map((e) =>
                e.id === localExId
                  ? { ...e, sets: e.sets.filter((st) => st.id !== setId) }
                  : e
              ),
            },
          };
        }),

      startRestTimer: (seconds) =>
        set({
          restTimerDurationSec: seconds,
          restTimerEndAt: Date.now() + seconds * 1000,
        }),

      adjustRestTimer: (deltaSeconds) =>
        set((s) => {
          const base = Math.max(Date.now(), s.restTimerEndAt ?? Date.now());
          const next = base + deltaSeconds * 1000;
          return {
            restTimerEndAt: next > Date.now() ? next : null,
          };
        }),

      clearRestTimer: () => set({ restTimerEndAt: null }),

      resetSession: () =>
        set({
          session: null,
          isSheetOpen: false,
          restTimerEndAt: null,
        }),
    }),
    {
      name: 'apexlift-workout-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        session: state.session,
        restTimerEndAt: state.restTimerEndAt,
        restTimerDurationSec: state.restTimerDurationSec,
      }),
    }
  )
);
