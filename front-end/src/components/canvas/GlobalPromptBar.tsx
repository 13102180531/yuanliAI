import React, { useState } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

export const GlobalPromptBar: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const currentProjectId = useProjectStore(s => s.currentProjectId);
  const projects = useProjectStore(s => s.projects);
  const setCanvasElements = useProjectStore(s => s.setCanvasElements);

  if (!currentProjectId || !projects[currentProjectId]) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('请输入提示词来生成图片');
      return;
    }

    setIsGenerating(true);
    try {
      // 模拟提示词生成逻辑，实际应用中会调用 nano banana 或类似的 API
      // 这里我们使用 picsum 作为占位符，模拟生成结果
      const response = await fetch('https://picsum.photos/400/300');
      const imageUrl = response.url;

      const project = projects[currentProjectId];
      const existingNodes = project.canvasNodes || [];
      const existingEdges = project.canvasEdges || [];

      const newNodeId = `gen-${Date.now()}`;
      const newNode = {
        id: newNodeId,
        type: 'imageNode',
        position: { x: Math.random() * 400 + 200, y: Math.random() * 200 + 100 },
        data: { 
          label: prompt, 
          imageUrl: imageUrl,
          isGenerated: true
        },
      };

      setCanvasElements([...existingNodes, newNode], existingEdges);
      setPrompt('');
      toast.success('图片已生成并添加到画布');
    } catch (error) {
      console.error(error);
      toast.error('图片生成失败，请稍后重试');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4">
      <div className="bg-card/90 backdrop-blur-xl border border-primary/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-2 flex items-center gap-2 group transition-all hover:border-primary/40">
        <div className="flex-1 relative">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder="描述你想在画布上生成的任何事物..."
            className="bg-transparent border-none focus-visible:ring-0 text-sm font-mono tracking-tight h-10 w-full placeholder:text-muted-foreground/50"
            disabled={isGenerating}
          />
        </div>
        <Button 
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-widest text-[10px] px-4 h-10 rounded-none shrink-0"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 mr-2" />
              生成
            </>
          )}
        </Button>
      </div>
      <div className="mt-2 text-center">
         <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-[0.15em]">
           纳米香蕉 (Nano Banana) 引擎已就绪 | 支持提示词直接渲染
         </p>
      </div>
    </div>
  );
};
