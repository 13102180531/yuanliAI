import { create } from 'zustand';
import { AssetEntity, AssetState } from '../types';

interface AssetStateUpdate {
  status?: AssetState['status'];
  progress?: number;
  imageUrl?: string | null;
}

interface AssetStore {
  characters: AssetEntity[];
  scenes: AssetEntity[];
  props: AssetEntity[];
  setAssets: (assets: { characters?: AssetEntity[]; scenes?: AssetEntity[]; props?: AssetEntity[] }) => void;
  updateAssetState: (entityId: string, stateId: string, updates: AssetStateUpdate) => void;
  resetAssets: () => void;
}

export const useAssetStore = create<AssetStore>((set) => ({
  characters: [],
  scenes: [],
  props: [],
  setAssets: (assets) => set((state) => ({ ...state, ...assets })),
  updateAssetState: (entityId, stateId, updates) =>
    set((state) => {
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
        characters: updateList(state.characters),
        scenes: updateList(state.scenes),
        props: updateList(state.props),
      };
    }),
  resetAssets: () => set({ characters: [], scenes: [], props: [] }),
}));
