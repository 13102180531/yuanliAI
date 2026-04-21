import React from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { useGenerationSocket } from '../../hooks/useGenerationSocket';
import { StoryboardNode } from './StoryboardNode';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Sparkles, Layers, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkflowStore, AppNode, AppEdge } from '../../stores/useCanvasStore';
import { useSettingsStore } from '../../stores/useSettingsStore';

export const StoryboardView: React.FC = () => {
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const currentProject = useProjectStore((s) => currentProjectId ? s.projects[currentProjectId] : null);
  const updateScene = useProjectStore((s) => s.updateScene);
  const scenes = currentProject?.storyboard || [];
  const { startSceneGen } = useGenerationSocket();

  const handleGenerate = (id: string) => {
    const scene = scenes.find(s => s.id === id);
    if (!scene) return;

    updateScene(id, { status: 'generating' });
    startSceneGen(id, {
      sceneId: id,
      finalPrompt: scene.finalPrompt,
      model: "luma-ray"
    });
  };

  const handleBatchGenerate = () => {
    scenes.forEach(scene => {
      if (scene.status !== 'completed') {
        handleGenerate(scene.id);
      }
    });
  };

  const { defaultModels } = useSettingsStore();

  const handleExportToCanvas = () => {
    if (!currentProject) return;
    const { assets, storyboard } = currentProject;
    
    const newNodes: AppNode[] = [];
    const newEdges: AppEdge[] = [];
    
    let currentY = 100;
    const X_ASSETS = 100;
    const X_STORYBOARD = 600;
    const X_VIDEO = 1100;

    const stateNodeIdMap: Record<string, string> = {};
    const stateIdToNameMap: Record<string, string> = {};

    const processAssetList = (entities: any[]) => {
      entities.forEach((entity) => {
        entity.states.forEach((state: any) => {
           const nodeId = `asset-${entity.id}-${state.stateId}`;
           stateNodeIdMap[state.stateId] = nodeId;
           stateIdToNameMap[state.stateId] = entity.name;
           newNodes.push({
             id: nodeId,
             type: 'imageBox',
             position: { x: X_ASSETS, y: currentY },
             width: 320,
             data: {
               label: `${entity.name} - ${state.stateName}`,
               params: {
                 prompt: `${entity.basePrompt}, ${state.promptModifier}`,
                 model: defaultModels.imageGeneration, ratio: '16:9', resolution: '2K', camera: '自动', lens: '自动', focal: '自动', lensType: '标准镜头'
               },
               status: state.imageUrl ? 'success' : 'idle',
               outputResult: state.imageUrl || undefined
             }
           });
           currentY += 400;
         });
      });
    };

    processAssetList(assets.characters || []);
    processAssetList(assets.scenes || []);
    processAssetList(assets.props || []);

    let sbY = 100;
    storyboard.forEach((scene) => {
       // 为每个分镜创建首帧、尾帧和视频节点
       const firstFrameNodeId = `sb-first-${scene.id}`;
       const lastFrameNodeId = `sb-last-${scene.id}`;
       const videoNodeId = `video-${scene.id}`;

       const bindIds = [
         ...(scene.boundAssets.characterIds || []),
         scene.boundAssets.sceneId,
         ...(scene.boundAssets.propIds || [])
       ].filter(Boolean);

       // 构建首帧提示词
       const firstFramePromptText = scene.firstFramePrompt || scene.finalPrompt;
       
       // 构建尾帧提示词
       const lastFramePromptText = scene.lastFramePrompt || scene.finalPrompt;
       
       // 构建视频提示词
       const videoPromptText = scene.videoPrompt || scene.finalPrompt;

       // 首帧节点
       newNodes.push({
         id: firstFrameNodeId,
         type: 'imageBox',
         position: { x: X_STORYBOARD, y: sbY },
         width: 380,
         data: {
           label: `分镜${scene.sceneNumber} - 首帧`,
           params: {
              prompt: firstFramePromptText,
              model: defaultModels.imageGeneration, ratio: '16:9', resolution: '2K', camera: '自动', lens: '自动', focal: '自动', lensType: '标准镜头'
           },
           status: scene.firstFrameUrl ? 'success' : 'idle',
           outputResult: scene.firstFrameUrl || undefined
         }
       });

       // 尾帧节点
       newNodes.push({
         id: lastFrameNodeId,
         type: 'imageBox',
         position: { x: X_STORYBOARD, y: sbY + 250 },
         width: 380,
         data: {
           label: `分镜${scene.sceneNumber} - 尾帧`,
           params: {
              prompt: lastFramePromptText,
              model: defaultModels.imageGeneration, ratio: '16:9', resolution: '2K', camera: '自动', lens: '自动', focal: '自动', lensType: '标准镜头'
           },
           status: scene.lastFrameUrl ? 'success' : 'idle',
           outputResult: scene.lastFrameUrl || undefined
         }
       });

       // 视频节点
       newNodes.push({
         id: videoNodeId,
         type: 'videoBox',
         position: { x: X_VIDEO, y: sbY + 125 },
         width: 380,
         data: {
           label: `视频 分镜${scene.sceneNumber}`,
           params: {
              prompt: `@[分镜${scene.sceneNumber} - 首帧.png] @[分镜${scene.sceneNumber} - 尾帧.png] ${videoPromptText}`,
              model: defaultModels.videoGeneration, ratio: '16:9', resolution: '1080P', duration: '4s'
           },
           status: scene.videoUrl ? 'success' : 'idle',
           outputResult: scene.videoUrl || undefined
         }
       });

       // 连接首帧到视频
       newEdges.push({
         id: `e-${firstFrameNodeId}-${videoNodeId}`,
         source: firstFrameNodeId,
         target: videoNodeId,
       });

       // 连接尾帧到视频
       newEdges.push({
         id: `e-${lastFrameNodeId}-${videoNodeId}`,
         source: lastFrameNodeId,
         target: videoNodeId,
       });

       // 连接资产到首帧
       bindIds.forEach(stateId => {
         const sourceNodeId = stateNodeIdMap[stateId];
         if (sourceNodeId) {
           newEdges.push({
             id: `e-${sourceNodeId}-${firstFrameNodeId}`,
             source: sourceNodeId,
             target: firstFrameNodeId,
           });
         }
       });

       sbY += 600;
    });

    // Final Video Synth Node
    if (storyboard.length > 0) {
      const X_SYNTH = 1600;
      const synthNodeId = `synth-final-${Date.now()}`;
      let synthPrompt = "将以下分镜片段合成为完整视频流：\n";

      storyboard.forEach(s => {
        const vidNodeLabel = `视频 分镜${s.sceneNumber}`;
        synthPrompt += `@[${vidNodeLabel}.mp4]\n`;

        newEdges.push({
          id: `e-v2s-${s.id}`,
          source: `video-${s.id}`,
          target: synthNodeId
        });
      });

      newNodes.push({
        id: synthNodeId,
        type: 'videoSynth',
        position: { x: X_SYNTH, y: 100 },
        width: 480,
        data: {
          label: "全剧合成序列 Beta",
          params: {
            prompt: synthPrompt
          },
          status: 'idle'
        }
      });
    }

    useWorkflowStore.setState({
        nodes: newNodes,
        edges: newEdges,
        groups: [] 
    });
    
    toast.success("资产已全部编排入无限画布！请在左侧切换查看。");
  };

  return (
    <div className="flex flex-col h-full gap-6 overflow-hidden">
      <div className="flex items-center justify-between px-1 shrink-0">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]" />
            <h2 className="text-xl font-black tracking-[0.1em] uppercase">分镜合成管线</h2>
          </div>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-50 ml-7">Storyboard Synthesis Pipeline</span>
        </div>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            onClick={handleExportToCanvas} 
            className="gap-2 rounded-none border border-primary/40 hover:bg-primary hover:text-primary-foreground font-bold uppercase tracking-widest text-[11px] h-10 px-6 transition-all"
            variant="outline"
          >
            <LayoutGrid className="w-4 h-4" /> 编排入无限画布
          </Button>
          <Button 
            size="sm" 
            onClick={handleBatchGenerate} 
            className="gap-2 rounded-none border border-primary/40 hover:bg-primary hover:text-primary-foreground font-bold uppercase tracking-widest text-[11px] h-10 px-6 transition-all"
            variant="outline"
          >
            <Sparkles className="w-4 h-4" /> 批量并发渲染
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full pr-4">
          <div className="space-y-6 pb-20">
            {scenes.map(node => (
              <StoryboardNode 
                key={node.id} 
                node={node} 
                onGenerate={handleGenerate}
              />
            ))}
            
            {scenes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground border border-dashed border-secondary rounded-none bg-black/20">
                <div className="p-6 border-2 border-dashed border-secondary/20 rounded-full mb-6">
                  <Sparkles className="w-12 h-12 opacity-10" />
                </div>
                <p className="text-xs uppercase font-bold tracking-[0.2em] opacity-40">等待剧本数据导入中...</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
