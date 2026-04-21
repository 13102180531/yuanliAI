
export interface AssetState {
  stateId: string; // 唯一ID，如 "CHAR_01_BASE"
  stateName: string; // 如 "日常形象", "重伤流血", "破损"
  isBaseState: boolean; // 【核心依赖标识】是否为该资产的最正常/基础状态
  parentStateId?: string; // 【图生图依赖】依赖的父状态ID
  promptModifier: string;// 状态附加提示词
  status: 'empty' | 'generating' | 'completed' | 'failed';
  progress: number; // 0-100 生成进度
  imageUrl: string | null;
}

export interface AssetEntity {
  id: string; // 如 "CHAR_01", "SCENE_01"
  name: string; // 如 "林越", "破旧餐馆"
  type: 'character' | 'scene' | 'prop';
  basePrompt: string; // 全局基础特征提取词
  states: AssetState[]; // 嵌套的状态变体列表
}

export interface SceneNode {
  id: string;
  sceneNumber: number;
  actionDesc: string; // 剧本动作描述
  description?: string; // 本镜头画面内容概述
  firstFramePrompt?: string; // 起始帧画面描述
  lastFramePrompt?: string; // 结束帧画面描述
  videoPrompt?: string; // 视频动态描述
  associatedCharacters?: string[];
  associatedProps?: string[];
  boundAssets: {
    characterIds: string[]; // 绑定的状态ID，如 ["CHAR_01_INJURED"]
    sceneId: string; // 绑定的场景状态ID
    propIds: string[]; // 绑定的道具状态ID
  };
  finalPrompt: string; // 融合所有资产后的最终提示词
  status: 'idle' | 'generating' | 'completed';
  resultUrl: string | null;
  firstFrameUrl?: string | null;
  lastFrameUrl?: string | null;
  videoUrl?: string | null;
}

export interface CanvasNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: any;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

export interface ApiProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models?: string[];
}

export interface GenerationSettings {
  apiProviders: ApiProvider[];
  activeProviderId: string | null;
  defaultModels: {
    textExtraction: string;
    imageGeneration: string;
    videoGeneration: string;
    audioGeneration: string;
  };
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  assets: {
    characters: AssetEntity[];
    scenes: AssetEntity[];
    props: AssetEntity[];
  };
  storyboard: SceneNode[];
  canvasNodes?: CanvasNode[];
  canvasEdges?: CanvasEdge[];
}
