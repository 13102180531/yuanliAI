# AI 剧本可视化引擎 - API 接口文档 v1.0

本文档描述了前端应用与后端服务交互所需的 API 接口。

## 1. 认证与基础配置

所有请求应包含在“系统设置”中配置的 API Key。
**Header:** `Authorization: Bearer <API_KEY>`

---

## 2. 剧本解析接口

### POST `/api/v1/script/parse`
解析剧本内容，提取角色、场景、道具及分镜大纲。

**Request Body:**
```json
{
  "scriptContent": "string (剧本全文)",
  "model": "string (可选，指定的解析模型)"
}
```

**Response Body (200 OK):**
```json
{
  "characters": [
    {
      "id": "string",
      "name": "string",
      "type": "character",
      "basePrompt": "string (角色的视觉基础描述)",
      "states": [
        {
          "stateId": "string",
          "stateName": "string (如：日常、战斗)",
          "isBaseState": boolean,
          "promptModifier": "string (状态修饰词)",
          "status": "empty",
          "progress": 0,
          "imageUrl": null
        }
      ]
    }
  ],
  "scenes": [
    {
      "id": "string",
      "name": "string",
      "type": "scene",
      "basePrompt": "string (场景的基础视觉描述)",
      "states": [
        {
          "stateId": "string",
          "stateName": "string",
          "isBaseState": boolean,
          "promptModifier": "string",
          "status": "empty",
          "progress": 0,
          "imageUrl": null
        }
      ]
    }
  ],
  "props": [
    {
      "id": "string",
      "name": "string",
      "type": "prop",
      "basePrompt": "string",
      "states": [
        {
          "stateId": "string",
          "stateName": "string",
          "isBaseState": boolean,
          "promptModifier": "string",
          "status": "empty",
          "progress": 0,
          "imageUrl": null
        }
      ]
    }
  ],
  "storyboard": [
    {
      "id": "string",
      "sceneNumber": number,
      "actionDesc": "string (动作描述)",
      "boundAssets": {
        "characterIds": ["string (stateId)"],
        "sceneId": "string (stateId)",
        "propIds": ["string (stateId)"]
      },
      "finalPrompt": "string (合成用的最终提示词)",
      "status": "idle",
      "resultUrl": null
    }
  ]
}
```

---

## 3. 异步生成接口 (WebSocket/长轮询)

前端通过发送指令启动生成任务，后端通过事件流回传进度和结果。

### WebSocket 消息格式
**Event Name:** `message`

#### 发送任务 (前端 -> 后端)
```json
{
  "action": "START_ASSET_GEN", // 资产生成
  "payload": {
    "entityId": "string",
    "stateId": "string",
    "entityType": "character | scene | prop",
    "fullPrompt": "string (basePrompt + promptModifier)",
    "baseImageUrl": "string (可选，基于哪个图生成变体)",
    "model": "string"
  }
}

{
  "action": "START_SCENE_GEN", // 分镜合成
  "payload": {
    "sceneId": "string",
    "finalPrompt": "string",
    "model": "string"
  }
}
```

#### 回传进度 (后端 -> 前端)
```json
{
  "event": "PROGRESS_UPDATE",
  "payload": {
    "entityId": "string (可选)",
    "targetId": "string (stateId 或 sceneId)",
    "status": "generating",
    "progress": number (0-100)
  }
}
```

#### 回传结果 (后端 -> 前端)
```json
{
  "event": "TASK_COMPLETED", // 资产完成
  "payload": {
    "entityId": "string",
    "targetId": "string (stateId)",
    "status": "completed",
    "progress": 100,
    "resultUrl": "string (生成的图片URL)"
  }
}

{
  "event": "SCENE_COMPLETED", // 分镜完成
  "payload": {
    "targetId": "string (storyboard node id)",
    "status": "completed",
    "resultUrl": "string"
  }
}
```

---

## 4. 资产存储建议 (可选)
如果后端需要持久化，建议按照以下路径存储生成的图片：
- `/assets/characters/{entityId}/{stateId}.png`
- `/assets/scenes/{entityId}/{stateId}.png`
- `/storyboards/{sceneId}.png`
