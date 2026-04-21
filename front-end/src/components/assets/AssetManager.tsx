import React from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { useGenerationSocket } from '../../hooks/useGenerationSocket';
import { AssetEntityGroup } from './AssetEntityGroup';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, MapPin, Box, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export const AssetManager: React.FC = () => {
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const currentProject = useProjectStore((s) => currentProjectId ? s.projects[currentProjectId] : null);
  const updateAssetState = useProjectStore((s) => s.updateAssetState);
  
  const { characters = [], scenes = [], props = [] } = currentProject?.assets || {};
  const { startAssetGen } = useGenerationSocket();

  const handleGenerate = (entityId: string, stateId: string) => {
    const findEntity = (id: string) => {
      return characters.find(c => c.id === id) || scenes.find(s => s.id === id) || props.find(p => p.id === id);
    };

    const entity = findEntity(entityId);
    if (!entity) return;

    const state = entity.states.find(s => s.stateId === stateId);
    if (!state) return;

    const baseState = entity.states.find(s => s.isBaseState);

    updateAssetState(entityId, stateId, { status: 'generating', progress: 0 });
    
    startAssetGen(entityId, stateId, {
      stateId,
      entityType: entity.type,
      fullPrompt: `${entity.basePrompt} ${state.promptModifier}`,
      baseImageUrl: baseState?.imageUrl,
      model: "flux-schnell"
    });
  };

  return (
    <div className="flex flex-col h-full gap-6 overflow-hidden">
      <div className="flex items-center justify-between px-1 shrink-0">
        <div className="flex flex-col">
          <h2 className="text-xl font-black tracking-[0.1em] uppercase">资产中台</h2>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">IP 资产全周期管理</span>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-30" />
          <Input
            placeholder="搜索资产..."
            className="pl-9 h-10 rounded-none bg-black/40 border-secondary focus-visible:ring-primary font-mono text-xs uppercase tracking-tighter"
          />
        </div>
      </div>

      <Tabs defaultValue="character" className="flex-1 flex flex-col min-h-0">
        <TabsList className="flex w-full mb-6 bg-transparent border-b border-secondary rounded-none h-12 p-0 gap-8 shrink-0">
          <TabsTrigger
            value="character"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-2 h-full flex items-center gap-2 text-[11px] font-black uppercase tracking-widest transition-all"
          >
            <User className="w-3.5 h-3.5 opacity-50" />
            <span>角色</span>
            <span className="opacity-30 ml-1">[{characters.length}]</span>
          </TabsTrigger>
          <TabsTrigger
            value="scene"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-2 h-full flex items-center gap-2 text-[11px] font-black uppercase tracking-widest transition-all"
          >
            <MapPin className="w-3.5 h-3.5 opacity-50" />
            <span>场景</span>
            <span className="opacity-30 ml-1">[{scenes.length}]</span>
          </TabsTrigger>
          <TabsTrigger
            value="prop"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-2 h-full flex items-center gap-2 text-[11px] font-black uppercase tracking-widest transition-all"
          >
            <Box className="w-3.5 h-3.5 opacity-50" />
            <span>道具</span>
            <span className="opacity-30 ml-1">[{props.length}]</span>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="pr-4">
              <TabsContent value="character" className="m-0 focus-visible:ring-0">
                <Accordion type="multiple" className="w-full space-y-4 pb-6">
                  {characters.map(entity => (
                    <AssetEntityGroup key={entity.id} entity={entity} onGenerate={handleGenerate} />
                  ))}
                </Accordion>
              </TabsContent>

              <TabsContent value="scene" className="m-0 focus-visible:ring-0">
                <Accordion type="multiple" className="w-full space-y-4 pb-6">
                  {scenes.map(entity => (
                    <AssetEntityGroup key={entity.id} entity={entity} onGenerate={handleGenerate} />
                  ))}
                </Accordion>
              </TabsContent>

              <TabsContent value="prop" className="m-0 focus-visible:ring-0">
                <Accordion type="multiple" className="w-full space-y-4 pb-6">
                  {props.map(entity => (
                    <AssetEntityGroup key={entity.id} entity={entity} onGenerate={handleGenerate} />
                  ))}
                </Accordion>
              </TabsContent>
            </div>
          </ScrollArea>
        </div>
      </Tabs>
    </div>
  );
};
