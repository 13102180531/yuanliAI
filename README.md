# 源力 AI · 剧本分镜生成平台

一款面向影视创作者、分镜师和 AI 艺术家的智能工作流平台。输入剧本文案，AI 自动解析人物、场景、道具，生成可直接用于 AI 生图/生视频/生音频的分镜提示词，并支持在无限画布上进行可视化编排与批量渲染。

## 功能特性

- **剧本智能解析**：基于 LLM 自动提取人物状态、场景描述、道具清单
- **分镜自动生成**：将剧本拆解为最小粒度的连续镜头，输出首帧/尾帧/视频提示词
- **资产状态管理**：支持人物多状态、场景多状态、道具多状态的精细化管理
- **无限画布编排**：拖拽式分镜节点编排，支持图片/视频/音频/全景/合成节点
- **AI 供应商管理**：支持配置多个 OpenAI 兼容 API 供应商，同步模型列表，灵活切换
- **批量渲染管线**：一键批量生成首帧图、尾帧图、视频片段及音频

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + Zustand |
| 后端 | Express + WebSocket + LangGraph + TypeScript |
| AI 接口 | OpenAI 兼容格式（支持任意兼容 `/v1/chat/completions` 的供应商） |
| 数据库 | PostgreSQL |

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/13102180531/yuanliAI.git
cd yuanliAI
```

### 2. 配置后端

```bash
cd back-end
npm install
```

创建环境变量文件：

```bash
cp .env.example .env
```

编辑 `.env`，填写你的数据库和可选的默认 API 配置：

```env
# 数据库（必填）
DB_HOST=localhost
DB_PORT=5432
DB_NAME=yuanli
DB_USER=postgres
DB_PASSWORD=your_password

# 可选：默认 AI 供应商兜底配置
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o-mini
```

初始化数据库：

```bash
# 先确保 PostgreSQL 服务已启动
psql -U postgres -d yuanli -f schema.sql
```

启动后端：

```bash
npm run dev
# 或
npx tsx server.ts
```

后端默认运行在 `http://localhost:3001`

### 3. 配置前端

```bash
cd front-end
npm install
```

创建环境变量文件：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
VITE_API_BASE_URL=ws://localhost:3001
```

启动前端：

```bash
npm run dev
```

前端默认运行在 `http://localhost:5173`

### 4. 生产构建

前端生产构建：

```bash
cd front-end
npm run build
```

构建产物位于 `front-end/dist`，可通过任意静态服务器部署。

## 前端使用指南

### 第一步：配置 API 供应商

1. 点击页面左上角的 **设置按钮**（齿轮图标）
2. 切换到 **「API 供应商」** 选项卡
3. 默认已内置「AI1哥」供应商（`https://ai1ge.com/v1`），点击 **编辑按钮（铅笔图标）** 填入你的 API Key
4. 点击 **同步按钮（刷新图标）** 拉取该供应商的所有可用模型
5. 切换到 **「默认模型设置」** 选项卡
6. 为「对话模型」「图片模型」「视频模型」「音频模型」分别选择默认模型

> 你也可以点击「添加供应商」来配置其他 OpenAI 兼容的 API 服务商。

### 第二步：导入剧本

1. 在左侧导航栏切换到 **「剧本导入」**
2. 将你的剧本文本粘贴到输入框中
3. 点击 **「开始解析」**
4. AI 将自动提取：
   - **人物**：识别所有角色及其不同状态（如正常状态、受伤状态等）
   - **场景**：识别所有地点及其不同环境状态
   - **道具**：识别剧本中出现的关键物品
   - **分镜**：将剧本拆解为连续镜头，生成首帧/尾帧/视频提示词

### 第三步：管理资产

1. 切换到 **「素材管理」**
2. 为每个人物/场景/道具的状态添加参考图或提示词
3. 确认所有资产状态都已绑定到对应的分镜中

### 第四步：编排与渲染

1. 切换到 **「分镜合成管线」**
2. 查看 AI 生成的分镜列表，每个分镜包含：
   - 首帧提示词（用于生成起始画面）
   - 尾帧提示词（用于生成结束画面）
   - 视频提示词（用于生成动态视频）
3. 点击 **「编排入无限画布」** 将所有分镜和资产节点导入画布
4. 在无限画布中：
   - 可自由拖拽调整节点位置
   - 双击节点编辑提示词
   - 通过连线建立节点依赖关系
   - 点击节点上的 **「运行」** 按钮调用 AI 生成内容
5. 点击 **「批量并发渲染」** 一键生成所有分镜素材

### 第五步：视频合成

1. 在画布中创建 **「视频编排」** 节点
2. 将多个视频片段节点连线到视频编排节点
3. 点击 **「获取上游视频」** 导入片段
4. 设置转场效果后点击 **「合成视频」**

## 项目结构

```
.
├── back-end/                  # 后端服务
│   ├── server.ts              # Express + WebSocket 主服务
│   ├── prompts/               # AI 提示词模板
│   │   ├── extract_characters.md
│   │   ├── extract_scenes.md
│   │   ├── extract_props.md
│   │   └── generate_storyboard.md
│   ├── schema.sql             # PostgreSQL 数据库结构
│   └── .env.example           # 后端环境变量示例
│
└── front-end/                 # 前端应用
    ├── src/
    │   ├── components/        # React 组件
    │   │   ├── canvas/        # 无限画布相关
    │   │   ├── storyboard/    # 分镜视图
    │   │   ├── assets/        # 资产管理
    │   │   ├── settings/      # 设置面板
    │   │   └── script/        # 剧本导入
    │   ├── stores/            # Zustand 状态管理
    │   ├── hooks/             # 自定义 Hooks
    │   └── types/             # TypeScript 类型定义
    ├── .env.example           # 前端环境变量示例
    └── vite.config.ts
```

## 环境变量说明

### 后端 `.env`

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `DB_HOST` | PostgreSQL 主机地址 | 是 |
| `DB_PORT` | PostgreSQL 端口 | 是 |
| `DB_NAME` | 数据库名称 | 是 |
| `DB_USER` | 数据库用户名 | 是 |
| `DB_PASSWORD` | 数据库密码 | 是 |
| `OPENAI_BASE_URL` | 默认 AI 供应商 Base URL | 否 |
| `OPENAI_API_KEY` | 默认 AI 供应商 API Key | 否 |
| `OPENAI_MODEL` | 默认 AI 模型名称 | 否 |

### 前端 `.env.local`

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `VITE_API_BASE_URL` | 后端 WebSocket 地址 | 是 |

## 许可证

MIT License
