import { AssetEntity, SceneNode } from "../types";

export const mockScriptData = {
  characters: [
    {
      id: "CHAR_01",
      name: "林越",
      type: "character",
      basePrompt: "一位前卫的未来英雄，拥有霓虹蓝眼睛，穿着高科技碳纤维盔甲。",
      states: [
        {
          stateId: "CHAR_01_BASE",
          stateName: "日常形象",
          isBaseState: true,
          promptModifier: "站在现代都市公寓中，表情冷静。",
          status: "completed",
          progress: 100,
          imageUrl: "https://picsum.photos/seed/linyue_base/400/600",
        },
        {
          stateId: "CHAR_01_INJURED",
          stateName: "重伤流血",
          isBaseState: false,
          promptModifier: "重伤，血迹从盔甲上滴落，眼神坚毅，背景为战场。",
          status: "empty",
          progress: 0,
          imageUrl: null,
        },
      ],
    },
    {
      id: "CHAR_02",
      name: "诺亚",
      type: "character",
      basePrompt: "一个拥有类人全息形态的精致 AI 伴侣，半透明且闪烁着光芒。",
      states: [
        {
          stateId: "CHAR_02_BASE",
          stateName: "基础形态",
          isBaseState: true,
          promptModifier: "中性漂浮姿势，散发着柔和白光。",
          status: "empty",
          progress: 0,
          imageUrl: null,
        },
      ],
    },
  ] as AssetEntity[],
  scenes: [
    {
      id: "SCENE_01",
      name: "破旧餐馆",
      type: "scene",
      basePrompt: "一个昏暗的复古未来主义餐馆，有闪烁的霓虹灯，窗外下着雨。",
      states: [
        {
          stateId: "SCENE_01_DAY",
          stateName: "日间",
          isBaseState: true,
          promptModifier: "阳光透过布满灰尘的窗户洒入，桌子空荡荡的。",
          status: "completed",
          progress: 100,
          imageUrl: "https://picsum.photos/seed/diner_day/800/400",
        },
        {
          stateId: "SCENE_01_NIGHT",
          stateName: "深夜",
          isBaseState: false,
          promptModifier: "赛博朋克霓虹灯闪烁，阴影密布，氛围神秘。",
          status: "empty",
          progress: 0,
          imageUrl: null,
        },
      ],
    },
  ] as AssetEntity[],
  props: [
    {
      id: "PROP_01",
      name: "神经脉冲枪",
      type: "prop",
      basePrompt: "一把高频能量手枪，拥有发光的能量电池和复杂的雕刻。",
      states: [
        {
          stateId: "PROP_01_BASE",
          stateName: "收纳状态",
          isBaseState: true,
          promptModifier: "收纳在腰带上，紧凑且未激活。",
          status: "empty",
          progress: 0,
          imageUrl: null,
        },
      ],
    },
  ] as AssetEntity[],
  storyboard: [
    {
      id: "SCENE_NODE_01",
      sceneNumber: 1,
      actionDesc: "林越步入破旧餐馆，在吧台坐下，诺亚出现在他身边。",
      boundAssets: {
        characterIds: ["CHAR_01_BASE", "CHAR_02_BASE"],
        sceneId: "SCENE_01_DAY",
        propIds: [],
      },
      finalPrompt: "林越 (CHAR_01_BASE) 坐在餐馆吧台前 (SCENE_01_DAY)，诺亚 (CHAR_02_BASE) 在他身边漂浮。",
      status: "idle",
      resultUrl: null,
    },
  ] as SceneNode[],
};
