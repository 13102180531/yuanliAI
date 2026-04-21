import React from 'react';
import { AssetState, AssetEntity } from '../../types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Lock, Play, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssetStateCardProps {
  entity: AssetEntity;
  state: AssetState;
  onGenerate: (entityId: string, stateId: string) => void;
}

export const AssetStateCard: React.FC<AssetStateCardProps> = ({ entity, state, onGenerate }) => {
  const baseState = entity.states.find((s) => s.isBaseState);
  const isLocked = !state.isBaseState && baseState?.status !== 'completed';

  const getStatusBadge = () => {
    switch (state.status) {
      case 'completed':
        return <span className="text-[10px] font-mono text-[#00ff66] font-bold uppercase tracking-widest">生成成功</span>;
      case 'generating':
        return <span className="text-[10px] font-mono text-primary font-bold uppercase tracking-widest animate-pulse">正在生成 {state.progress}%</span>;
      case 'failed':
        return <span className="text-[10px] font-mono text-destructive font-bold uppercase tracking-widest">生成异常</span>;
      default:
        return <span className="text-[10px] font-mono text-muted-foreground font-bold uppercase tracking-widest">等待队列</span>;
    }
  };

  return (
    <Card className={cn(
      "overflow-hidden group transition-all duration-300 rounded-none border-secondary relative",
      isLocked ? "opacity-40 bg-[#3a1a1a]" : "bg-card"
    )}>
      <CardHeader className="p-3 border-b border-secondary bg-muted/10">
        <div className="flex justify-between items-center">
          <CardTitle className="text-[11px] font-bold uppercase tracking-wider">{entity.name} - {state.stateName}</CardTitle>
          {state.isBaseState && <div className="text-[9px] text-primary border border-primary/20 px-1 font-mono uppercase">基准</div>}
        </div>
      </CardHeader>
      <CardContent className="p-0 aspect-[4/5] relative bg-black flex items-center justify-center overflow-hidden">
        {state.imageUrl ? (
          <img
            src={state.imageUrl}
            alt={state.stateName}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground/30">
            {isLocked ? (
               <Lock className="w-8 h-8 opacity-20" />
            ) : (
               <Play className="w-8 h-8 opacity-20 group-hover:opacity-100 transition-opacity" />
            )}
            <span className="text-[10px] uppercase font-mono tracking-tighter">{isLocked ? "锁定" : "就绪"}</span>
          </div>
        )}

        {state.status === 'generating' && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center p-6">
            <div className="w-full space-y-2">
              <div className="flex justify-between text-[9px] font-mono text-primary font-bold">
                <span>渲染中...</span>
                <span>{state.progress}%</span>
              </div>
              <div className="w-full h-[2px] bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 shadow-[0_0_8px_#00f0ff]"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {isLocked && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5 text-[8px] font-mono text-destructive font-bold uppercase tracking-tighter bg-black/60 px-1.5 py-0.5 border border-destructive/30">
            <Lock className="w-2.5 h-2.5" /> 依赖锁定
          </div>
        )}
      </CardContent>
      <CardFooter className="p-3 flex items-center justify-center border-t border-secondary bg-black/20">
        {getStatusBadge()}
      </CardFooter>
    </Card>
  );
};
