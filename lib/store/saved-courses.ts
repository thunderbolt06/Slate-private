import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SavedCoursesState {
  savedIds: string[];
  markSaved: (id: string) => void;
  isSaved: (id: string) => boolean;
}

export const useSavedCoursesStore = create<SavedCoursesState>()(
  persist(
    (set, get) => ({
      savedIds: [],
      markSaved: (id) =>
        set((state) =>
          state.savedIds.includes(id) ? state : { savedIds: [...state.savedIds, id] },
        ),
      isSaved: (id) => get().savedIds.includes(id),
    }),
    { name: 'saved-courses-v1' },
  ),
);
