import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SceneProgress {
  visitedSceneIds: string[];
  totalScenes: number;
  lastOpenedAt: number;
}

interface CourseProgressState {
  progress: Record<string, SceneProgress>;
  markSceneVisited: (stageId: string, sceneId: string, totalScenes: number) => void;
  getProgressPercent: (stageId: string, totalScenes: number) => number;
  getVisitedCount: (stageId: string) => number;
  resetProgress: (stageId: string) => void;
}

export const useCourseProgressStore = create<CourseProgressState>()(
  persist(
    (set, get) => ({
      progress: {},

      markSceneVisited: (stageId, sceneId, totalScenes) => {
        set((state) => {
          const existing = state.progress[stageId];
          const visitedSceneIds = existing?.visitedSceneIds ?? [];
          if (visitedSceneIds.includes(sceneId)) {
            return {
              progress: {
                ...state.progress,
                [stageId]: { ...existing, totalScenes, lastOpenedAt: Date.now() },
              },
            };
          }
          return {
            progress: {
              ...state.progress,
              [stageId]: {
                visitedSceneIds: [...visitedSceneIds, sceneId],
                totalScenes,
                lastOpenedAt: Date.now(),
              },
            },
          };
        });
      },

      getProgressPercent: (stageId, totalScenes) => {
        const prog = get().progress[stageId];
        if (!prog || totalScenes === 0) return 0;
        return Math.min(100, Math.round((prog.visitedSceneIds.length / totalScenes) * 100));
      },

      getVisitedCount: (stageId) => {
        return get().progress[stageId]?.visitedSceneIds.length ?? 0;
      },

      resetProgress: (stageId) => {
        set((state) => {
          const next = { ...state.progress };
          delete next[stageId];
          return { progress: next };
        });
      },
    }),
    { name: 'course-progress-v1' },
  ),
);
