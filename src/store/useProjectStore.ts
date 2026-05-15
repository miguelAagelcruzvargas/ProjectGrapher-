import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAiSlice, createProjectSlice, createUiSlice } from './projectStore.slices';
import type { ProjectState } from './projectStore.types';

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      ...createProjectSlice(set, get),
      ...createAiSlice(set, get),
      ...createUiSlice(set)
    }),
    {
      name: 'project-grapher-settings',
      partialize: (state) => ({
        aiProvider: state.aiProvider,
        aiModel: state.aiModel,
        customUrl: state.customUrl,
        customKey: state.customKey,
        customKeys: state.customKeys,
        useDeepAnalysis: state.useDeepAnalysis,
        projectMemory: state.projectMemory
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<ProjectState>) || {};
        const provider = persisted.aiProvider || currentState.aiProvider;
        const persistedCustomKeys = persisted.customKeys || {};
        const persistedProjectMemory = persisted.projectMemory || {};
        const resolvedCustomKeys = {
          ...currentState.customKeys,
          ...persistedCustomKeys
        };

        return {
          ...currentState,
          ...persisted,
          projectMemory: {
            ...currentState.projectMemory,
            ...persistedProjectMemory
          },
          customKeys: resolvedCustomKeys,
          customKey: resolvedCustomKeys[provider] || ''
        };
      }
    }
  )
);
