import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GenerationSettings, ApiProvider } from '../types';

export interface ModelInfo {
  id: string;
  name: string;
  type: 'image' | 'video' | 'text' | 'audio';
}

export interface SettingsState extends GenerationSettings {
  models: ModelInfo[];
  addProvider: (provider: ApiProvider) => void;
  updateProvider: (id: string, provider: Partial<ApiProvider>) => void;
  removeProvider: (id: string) => void;
  setActiveProvider: (id: string) => void;
  updateDefaultModels: (models: Partial<GenerationSettings['defaultModels']>) => void;
  syncModels: (providerId: string) => Promise<void>;
  setModels: (models: ModelInfo[]) => void;
  getImageModels: () => ModelInfo[];
  getVideoModels: () => ModelInfo[];
  getTextModels: () => ModelInfo[];
  getAudioModels: () => ModelInfo[];
  getProviderModels: (providerId: string) => string[];
}

const AI1GE_PROVIDER: ApiProvider = {
  id: 'ai1ge-default',
  name: 'AI1哥',
  baseUrl: 'https://ai1ge.com/v1',
  apiKey: '',
  models: [],
};

function detectModelType(modelId: string): 'image' | 'video' | 'text' | 'audio' {
  const id = modelId.toLowerCase();

  const videoKeywords = [
    'video', 'luma', 'runway', 'kling', 'sora', 'veo', 'seedance',
    'wan', 'grok-video', 'hailuo', 'minimax', 'kling-video'
  ];
  const imageKeywords = [
    'image', 'flux', 'dall', 'midjourney', 'ideogram', 'stable-diffusion',
    'sdxl', 'imagen', 'gpt-image', 'seedream', 'seededit', 'qwen-image',
    'nano-banana', 'recraft', 'vace', 'wan-i2v', 'wan-t2v'
  ];
  const audioKeywords = [
    'audio', 'speech', 'tts', 'voice', 'sound', 'music',
    'suno', 'udio', 'minimax-speech', 'minimax-music',
    'minimax-audio', 'elevenlabs', 'fish-speech'
  ];

  if (videoKeywords.some(k => id.includes(k))) return 'video';
  if (imageKeywords.some(k => id.includes(k))) return 'image';
  if (audioKeywords.some(k => id.includes(k))) return 'audio';

  // 额外判断：很多图像/视频模型有特定后缀
  if (id.includes('-i2v') || id.includes('-t2v') || id.includes('-t2i') || id.includes('-i2i')) {
    if (id.includes('video') || id.includes('v2v')) return 'video';
    return 'image';
  }

  return 'text';
}

const INITIAL_STATE = {
  apiProviders: [AI1GE_PROVIDER],
  activeProviderId: 'ai1ge-default',
  models: [] as ModelInfo[],
  defaultModels: {
    textExtraction: 'gemini-2.0-flash',
    imageGeneration: 'gpt-image-1',
    videoGeneration: 'luma',
    audioGeneration: 'minimax-speech',
  },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,
      addProvider: (provider) =>
        set((state) => ({ apiProviders: [...state.apiProviders, provider] })),
      updateProvider: (id, provider) =>
        set((state) => ({
          apiProviders: state.apiProviders.map((p) =>
            p.id === id ? { ...p, ...provider } : p
          ),
        })),
      removeProvider: (id) =>
        set((state) => ({
          apiProviders: state.apiProviders.filter((p) => p.id !== id),
          activeProviderId: state.activeProviderId === id ? null : state.activeProviderId,
        })),
      setActiveProvider: (id) => set({ activeProviderId: id }),
      updateDefaultModels: (models) =>
        set((state) => ({ defaultModels: { ...state.defaultModels, ...models } })),

      syncModels: async (providerId) => {
        const provider = get().apiProviders.find((p) => p.id === providerId);
        if (!provider || !provider.apiKey) {
          throw new Error('请先配置 API Key');
        }

        try {
          const response = await fetch(`${provider.baseUrl}/models`, {
            headers: {
              'Authorization': `Bearer ${provider.apiKey}`
            }
          });

          if (!response.ok) {
            throw new Error('同步失败，请检查 API Key 是否正确');
          }

          const data = await response.json();
          const allModels: ModelInfo[] = data.data.map((model: any) => {
            const modelId = model.id;
            return {
              id: modelId,
              name: modelId,
              type: detectModelType(modelId)
            };
          });

          // 更新供应商的模型列表
          const providerModelIds = allModels.map(m => m.id);
          set((state) => ({
            models: allModels,
            apiProviders: state.apiProviders.map((p) =>
              p.id === providerId ? { ...p, models: providerModelIds } : p
            ),
          }));
        } catch (error: any) {
          throw new Error(error.message || '同步失败');
        }
      },

      setModels: (models) => set({ models }),

      getImageModels: () => {
        return get().models.filter((m) => m.type === 'image');
      },

      getVideoModels: () => {
        return get().models.filter((m) => m.type === 'video');
      },

      getTextModels: () => {
        return get().models.filter((m) => m.type === 'text');
      },

      getAudioModels: () => {
        return get().models.filter((m) => m.type === 'audio');
      },

      getProviderModels: (providerId) => {
        const provider = get().apiProviders.find((p) => p.id === providerId);
        return provider?.models || [];
      }
    }),
    {
      name: 'ai-script-settings-storage',
      version: 2,
      migrate: (persistedState: any, version) => {
        // 如果旧版本没有数据结构，或没有 AI1哥，重置为初始状态
        const state = persistedState || {};
        const providers = state.apiProviders || [];
        const ai1geIndex = providers.findIndex((p: any) => p?.id === 'ai1ge-default');

        if (ai1geIndex === -1) {
          // 没有 AI1哥，添加默认配置
          return {
            ...INITIAL_STATE,
            apiProviders: [AI1GE_PROVIDER, ...providers],
          };
        }

        // 更新 AI1哥 的 baseUrl（只更新地址，保留用户填写的 apiKey）
        const updatedProviders = [...providers];
        updatedProviders[ai1geIndex] = {
          ...updatedProviders[ai1geIndex],
          baseUrl: AI1GE_PROVIDER.baseUrl,
        };

        return {
          ...state,
          apiProviders: updatedProviders,
        };
      },
    }
  )
);

