import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';

export interface CourseGroup {
  id: string;
  name: string;
  courseIds: string[];
  createdAt: number;
}

interface CourseGroupsState {
  groups: Record<string, CourseGroup>;
  createGroup: (courseId1: string, courseId2: string, name?: string) => string;
  addToGroup: (groupId: string, courseId: string) => void;
  removeFromGroup: (groupId: string, courseId: string) => void;
  renameGroup: (groupId: string, name: string) => void;
  deleteGroup: (groupId: string) => void;
  getCourseGroupId: (courseId: string) => string | null;
  getGroupedCourseIds: () => string[];
}

export const useCourseGroupsStore = create<CourseGroupsState>()(
  persist(
    (set, get) => ({
      groups: {},

      createGroup: (courseId1, courseId2, name = 'New Group') => {
        const id = nanoid(8);
        set((state) => ({
          groups: {
            ...state.groups,
            [id]: { id, name, courseIds: [courseId1, courseId2], createdAt: Date.now() },
          },
        }));
        return id;
      },

      addToGroup: (groupId, courseId) =>
        set((state) => {
          const group = state.groups[groupId];
          if (!group || group.courseIds.includes(courseId)) return state;
          return {
            groups: {
              ...state.groups,
              [groupId]: { ...group, courseIds: [...group.courseIds, courseId] },
            },
          };
        }),

      removeFromGroup: (groupId, courseId) =>
        set((state) => {
          const group = state.groups[groupId];
          if (!group) return state;
          const remaining = group.courseIds.filter((id) => id !== courseId);
          if (remaining.length < 2) {
            // Dissolve the group if fewer than 2 courses remain
            const next = { ...state.groups };
            delete next[groupId];
            return { groups: next };
          }
          return {
            groups: { ...state.groups, [groupId]: { ...group, courseIds: remaining } },
          };
        }),

      renameGroup: (groupId, name) =>
        set((state) => ({
          groups: { ...state.groups, [groupId]: { ...state.groups[groupId], name } },
        })),

      deleteGroup: (groupId) =>
        set((state) => {
          const next = { ...state.groups };
          delete next[groupId];
          return { groups: next };
        }),

      getCourseGroupId: (courseId) => {
        const groups = get().groups;
        const found = Object.values(groups).find((g) => g.courseIds.includes(courseId));
        return found?.id ?? null;
      },

      getGroupedCourseIds: () => {
        const groups = get().groups;
        return Object.values(groups).flatMap((g) => g.courseIds);
      },
    }),
    { name: 'course-groups-v1' },
  ),
);
