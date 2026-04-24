import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StarredCoursesState {
  starredIds: string[];
  toggle: (id: string) => void;
  isStarred: (id: string) => boolean;
}

export const useStarredCoursesStore = create<StarredCoursesState>()(
  persist(
    (set, get) => ({
      starredIds: [],
      toggle: (id) =>
        set((state) =>
          state.starredIds.includes(id)
            ? { starredIds: state.starredIds.filter((x) => x !== id) }
            : { starredIds: [...state.starredIds, id] },
        ),
      isStarred: (id) => get().starredIds.includes(id),
    }),
    { name: 'starred-courses-v1' },
  ),
);
