import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Project, AssetEntity, AssetState, SceneNode } from '../types';

interface ProjectStore {
  projects: Record<string, Project>;
  currentProjectId: string | null;
  isGlobalLoading: boolean;
  globalLoadingMessage: string;
  // Global Loading
  setGlobalLoading: (loading: boolean, message?: string) => void;
  // Navigation
  setCurrentProject: (id: string | null) => void;
  // Project Management
  createProject: (name: string) => string;
  deleteProject: (id: string) => void;
  // Assets Management (applies to current project)
  setAssets: (assets: { characters?: AssetEntity[]; scenes?: AssetEntity[]; props?: AssetEntity[] }, projectId?: string) => void;
  updateAssetState: (entityId: string, stateId: string, updates: Partial<AssetState>) => void;
  // Storyboard Management (applies to current project)
  setScenes: (scenes: SceneNode[], projectId?: string) => void;
  updateScene: (id: string, updates: Partial<SceneNode>) => void;
  // Canvas Management
  setCanvasElements: (nodes: any[], edges: any[]) => void;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: {},
      currentProjectId: null,
      isGlobalLoading: false,
      globalLoadingMessage: '',
      setGlobalLoading: (loading, message = '') => set({ isGlobalLoading: loading, globalLoadingMessage: message }),
      setCurrentProject: (id) => set({ currentProjectId: id }),
      createProject: (name) => {
        const id = `PROJ_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        set((state) => ({
          projects: {
            ...state.projects,
            [id]: {
              id,
              name,
              createdAt: Date.now(),
              assets: { characters: [], scenes: [], props: [] },
              storyboard: [],
              canvasNodes: [],
              canvasEdges: [],
            },
          },
          currentProjectId: id,
        }));
        return id;
      },
      deleteProject: (id) =>
        set((state) => {
          const newProjects = { ...state.projects };
          delete newProjects[id];
          return {
            projects: newProjects,
            currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
          };
        }),
      setAssets: (assets, projectId) =>
        set((state) => {
          const pid = projectId || state.currentProjectId;
          if (!pid || !state.projects[pid]) return state;
          const proj = state.projects[pid];
          return {
            projects: {
              ...state.projects,
              [pid]: {
                ...proj,
                assets: {
                  characters: assets.characters || proj.assets.characters,
                  scenes: assets.scenes || proj.assets.scenes,
                  props: assets.props || proj.assets.props,
                },
              },
            },
          };
        }),
      updateAssetState: (entityId, stateId, updates) =>
        set((state) => {
          const pid = state.currentProjectId;
          if (!pid || !state.projects[pid]) return state;
          const proj = state.projects[pid];
          
          const updateList = (list: AssetEntity[]) =>
            list.map((entity) => {
              if (entity.id !== entityId) return entity;
              return {
                ...entity,
                states: entity.states.map((s) =>
                  s.stateId === stateId ? { ...s, ...updates } : s
                ),
              };
            });

          return {
            projects: {
              ...state.projects,
              [pid]: {
                ...proj,
                assets: {
                  characters: updateList(proj.assets.characters),
                  scenes: updateList(proj.assets.scenes),
                  props: updateList(proj.assets.props),
                },
              },
            },
          };
        }),
      setScenes: (scenes, projectId) =>
        set((state) => {
          const pid = projectId || state.currentProjectId;
          if (!pid || !state.projects[pid]) return state;
          return {
            projects: {
              ...state.projects,
              [pid]: {
                ...state.projects[pid],
                storyboard: scenes,
              },
            },
          };
        }),
      updateScene: (id, updates) =>
        set((state) => {
          const pid = state.currentProjectId;
          if (!pid || !state.projects[pid]) return state;
          const proj = state.projects[pid];
          return {
            projects: {
              ...state.projects,
              [pid]: {
                ...proj,
                storyboard: proj.storyboard.map((scene) =>
                  scene.id === id ? { ...scene, ...updates } : scene
                ),
              },
            },
          };
        }),
      setCanvasElements: (nodes, edges) =>
        set((state) => {
          const pid = state.currentProjectId;
          if (!pid || !state.projects[pid]) return state;
          return {
            projects: {
              ...state.projects,
              [pid]: {
                ...state.projects[pid],
                canvasNodes: nodes,
                canvasEdges: edges,
              },
            },
          };
        }),
    }),
    {
      name: 'ai-story-engine-storage',
    }
  )
);
