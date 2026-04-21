import { create } from 'zustand';
import { SceneNode } from '../types';

interface StoryboardStore {
  scenes: SceneNode[];
  setScenes: (scenes: SceneNode[]) => void;
  updateScene: (id: string, updates: Partial<SceneNode>) => void;
  resetStoryboard: () => void;
}

export const useStoryboardStore = create<StoryboardStore>((set) => ({
  scenes: [],
  setScenes: (scenes) => set({ scenes }),
  updateScene: (id, updates) =>
    set((state) => ({
      scenes: state.scenes.map((scene) =>
        scene.id === id ? { ...scene, ...updates } : scene
      ),
    })),
  resetStoryboard: () => set({ scenes: [] }),
}));
