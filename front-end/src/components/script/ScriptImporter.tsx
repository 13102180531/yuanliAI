import React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { useProjectStore } from '../../stores/useProjectStore';
import { useGenerationSocket } from '../../hooks/useGenerationSocket';
import { toast } from 'sonner';

export const ScriptImporter: React.FC = () => {
  const [script, setScript] = React.useState('');
  const currentProjectId = useProjectStore(s => s.currentProjectId);
  const { parseScript } = useGenerationSocket();
  const isGlobalLoading = useProjectStore(s => s.isGlobalLoading);

  const handleImport = async () => {
    if (!script.trim()) {
      toast.error("请输入剧本内容");
      return;
    }

    parseScript(script, currentProjectId);
  };

  return (
    <div className="w-full h-full overflow-y-auto pb-24 scrollbar-thin scrollbar-thumb-secondary scrollbar-track-transparent">
      <div className="max-w-4xl mx-auto py-4 sm:py-8">
        <Card className="rounded-none border-secondary bg-background shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <CardHeader className="text-center pb-6 border-b border-secondary">
          <div className="w-14 h-14 bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mx-auto mb-6">
            <FileText className="w-7 h-7" />
          </div>
          <CardTitle className="text-2xl font-black uppercase tracking-[0.1em]">剧本解析中枢</CardTitle>
          <CardDescription className="uppercase text-[10px] font-bold tracking-widest opacity-50 mt-2">神经提取与工作流对齐</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="relative">
            <Textarea
              placeholder="请在此输入或粘贴剧本内容..."
              className="h-[400px] [field-sizing:fixed] overflow-y-auto bg-black/40 border-secondary rounded-none p-6 focus-visible:ring-primary font-mono text-sm leading-relaxed resize-none placeholder:opacity-20 translate-z-0"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              style={{ fieldSizing: 'fixed' } as any}
            />
            {script.length > 0 && (
              <div className="absolute bottom-4 right-4 text-[9px] text-primary/60 font-mono font-bold uppercase tracking-widest bg-black/80 px-2 py-1 border border-primary/20">
                {script.length} 字符
              </div>
            )}
          </div>
          
          <Button 
            className="w-full h-14 text-[14px] font-black uppercase tracking-[0.2em] rounded-none shadow-none border border-primary/40 hover:bg-primary hover:text-primary-foreground group transition-all" 
            onClick={handleImport}
            disabled={isGlobalLoading}
          >
            {isGlobalLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                正在解析全案序列...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-3 group-hover:drop-shadow-[0_0_8px_white]" />
                启动视觉引擎提取
              </>
            )}
          </Button>

          <div className="grid grid-cols-3 gap-8 pt-8 border-t border-secondary font-mono">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <span className="text-[12px] font-black text-primary">实体提取</span>
              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest opacity-40">IP 资产解析</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center border-x border-secondary">
              <span className="text-[12px] font-black text-primary">同步节点</span>
              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest opacity-40">分镜资产绑定</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center">
              <span className="text-[12px] font-black text-primary">渲染管线</span>
              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest opacity-40">批量生成</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 border border-secondary bg-black/20 flex flex-col gap-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#00ff66] flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> 最佳参数
          </div>
          <ul className="text-[11px] text-muted-foreground space-y-2 opacity-60">
            <li className="flex gap-2"><span>[01]</span> 请明确标注场景边界以实现高精度提取。</li>
            <li className="flex gap-2"><span>[02]</span> 定义角色特征以锁定美学一致性。</li>
          </ul>
        </div>
        
        <div className="p-5 border border-primary/20 bg-primary/5 flex flex-col gap-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" /> 系统能力
          </div>
          <p className="text-[11px] text-muted-foreground opacity-60">
            解析完成后，您可以导航到资产库管理各种变体，并在最终合成前验证依赖锁定。
          </p>
        </div>
      </div>
      </div>
    </div>
  );
};
