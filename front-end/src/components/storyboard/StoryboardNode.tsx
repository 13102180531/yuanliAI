import React from 'react';
import { SceneNode, AssetEntity, AssetState } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, CheckCircle2, Loader2, Image as ImageIcon } from 'lucide-react';
import { useProjectStore } from '../../stores/useProjectStore';

interface StoryboardNodeProps {
  node: SceneNode;
  onGenerate: (id: string) => void;
}

export const StoryboardNode: React.FC<StoryboardNodeProps> = ({ node, onGenerate }) => {
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const currentProject = useProjectStore((s) => currentProjectId ? s.projects[currentProjectId] : null);
  const { characters = [], scenes = [], props = [] } = currentProject?.assets || {};

  const getBoundAssetInfo = () => {
    const list: { name: string, stateName: string }[] = [];
    
    // Find character states
    node.boundAssets.characterIds.forEach(id => {
      characters.forEach(c => {
        const state = c.states.find(s => s.stateId === id);
        if (state) list.push({ name: c.name, stateName: state.stateName });
      });
    });

    // Find scene state
    scenes.forEach(s => {
      const state = s.states.find(st => st.stateId === node.boundAssets.sceneId);
      if (state) list.push({ name: s.name, stateName: state.stateName });
    });

    // Find prop states
    node.boundAssets.propIds.forEach(id => {
      props.forEach(p => {
        const state = p.states.find(s => s.stateId === id);
        if (state) list.push({ name: p.name, stateName: state.stateName });
      });
    });

    return list;
  };

  const boundAssets = getBoundAssetInfo();

  return (
    <Card className="mb-8 overflow-hidden rounded-none border-secondary bg-background shadow-[0_4px_24px_rgba(0,0,0,0.4)] relative group">
      <div className="flex flex-col">
        <div className="px-5 py-3 border-b border-secondary bg-muted/5 flex justify-between items-center font-mono text-[11px]">
          <span className="text-primary font-bold tracking-widest uppercase">#场景_{node.sceneNumber.toString().padStart(2, '0')}</span>
          <span className="text-muted-foreground opacity-60">00:{node.sceneNumber.toString().padStart(2, '0')}:{(node.sceneNumber * 12).toString().padStart(2, '0')}</span>
        </div>

        <div className="p-5">
          <p className="text-[14px] text-foreground/70 leading-relaxed mb-6">
            {node.actionDesc}
          </p>

          <div className="space-y-4">
            <div>
              <div className="text-[9px] uppercase text-muted-foreground font-black mb-2 tracking-[0.2em] opacity-50">绑定资产</div>
              <div className="flex flex-wrap gap-2">
                {boundAssets.map((asset, i) => (
                  <span key={i} className="text-[10px] py-1 px-2 font-bold uppercase tracking-tight bg-primary/10 text-primary border border-primary/20 rounded-sm">
                    {asset.name}:{asset.stateName}
                  </span>
                ))}
              </div>
            </div>

            {node.firstFramePrompt && (
              <div className="relative">
                <div className="absolute -top-2 left-2 px-2 py-0.5 bg-primary/20 text-primary text-[8px] font-black uppercase tracking-wider z-10">
                  首帧
                </div>
                <div className="text-[11px] bg-black/40 p-3 pt-4 rounded-none border border-secondary font-mono text-muted-foreground break-all leading-relaxed whitespace-pre-wrap">
                  {node.firstFramePrompt}
                </div>
              </div>
            )}

            {node.lastFramePrompt && (
              <div className="relative">
                <div className="absolute -top-2 left-2 px-2 py-0.5 bg-primary/20 text-primary text-[8px] font-black uppercase tracking-wider z-10">
                  尾帧
                </div>
                <div className="text-[11px] bg-black/40 p-3 pt-4 rounded-none border border-secondary font-mono text-muted-foreground break-all leading-relaxed whitespace-pre-wrap">
                  {node.lastFramePrompt}
                </div>
              </div>
            )}

            {node.videoPrompt && (
              <div className="relative">
                <div className="absolute -top-2 left-2 px-2 py-0.5 bg-primary/20 text-primary text-[8px] font-black uppercase tracking-wider z-10">
                  视频
                </div>
                <div className="text-[11px] bg-black/40 p-3 pt-4 rounded-none border border-secondary font-mono text-muted-foreground break-all leading-relaxed whitespace-pre-wrap">
                  {node.videoPrompt}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
