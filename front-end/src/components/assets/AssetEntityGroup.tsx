import React from 'react';
import { AssetEntity } from '../../types';
import { AssetStateCard } from './AssetStateCard';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { User, MapPin, Box } from 'lucide-react';

interface AssetEntityGroupProps {
  entity: AssetEntity;
  onGenerate: (entityId: string, stateId: string) => void;
}

export const AssetEntityGroup: React.FC<AssetEntityGroupProps> = ({ entity, onGenerate }) => {
  const getIcon = () => {
    switch (entity.type) {
      case 'character': return <User className="w-4 h-4 mr-2 text-primary" />;
      case 'scene': return <MapPin className="w-4 h-4 mr-2 text-[#00ff66]" />;
      case 'prop': return <Box className="w-4 h-4 mr-2 text-amber-500" />;
    }
  };

  return (
    <AccordionItem value={entity.id} className="border-secondary rounded-none mb-6 bg-card px-0 overflow-hidden">
      <AccordionTrigger className="hover:no-underline py-4 px-5 hover:bg-muted/5 group transition-colors">
        <div className="flex items-center text-left w-full justify-between pr-4">
          <div className="flex items-center">
            {getIcon()}
            <div>
              <div className="font-black text-[14px] uppercase tracking-wider">{entity.name}</div>
              <div className="text-[9px] font-mono text-muted-foreground uppercase opacity-40 mt-0.5 truncate max-w-md">{entity.basePrompt}</div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-primary border border-primary/20 px-2 py-0.5 rounded-none uppercase tracking-widest hidden sm:block">
            {entity.type === 'character' ? '角色实体' : entity.type === 'scene' ? '环境实体' : '道具实体'}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-6 px-5 border-t border-secondary bg-black/10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pt-6">
          {entity.states.map(state => (
            <AssetStateCard 
              key={state.stateId} 
              entity={entity} 
              state={state} 
              onGenerate={onGenerate}
            />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
