import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface WorkoutPhotosState {
  photosByPostId: Record<string, string[]>;
  setPostPhotos: (postId: string, uris: string[]) => void;
  clearPhotos: () => void;
}

export const useWorkoutPhotosStore = create<WorkoutPhotosState>()(
  persist(
    (set) => ({
      photosByPostId: {},
      setPostPhotos: (postId, uris) =>
        set((s) => ({
          photosByPostId: {
            ...s.photosByPostId,
            [postId]: uris.slice(0, 4),
          },
        })),
      clearPhotos: () => set({ photosByPostId: {} }),
    }),
    {
      name: 'top1-workout-photos',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
