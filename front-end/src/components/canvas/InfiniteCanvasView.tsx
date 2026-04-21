import React from 'react';
import { AdvancedCanvas } from './AdvancedCanvas';
import { useProjectStore } from '../../stores/useProjectStore';

export const InfiniteCanvasView: React.FC = () => {
  const currentProjectId = useProjectStore(s => s.currentProjectId);
  const project = currentProjectId ? useProjectStore(s => s.projects[currentProjectId]) : null;

  if (!project) return <div className="p-10 text-muted-foreground">未检测到项目数据，请返回首页并创建一个新草稿。</div>;

  return (
    <div className="flex-1 w-full relative h-[100%] min-h-[600px] border border-gray-800 rounded-lg overflow-hidden">
        <AdvancedCanvas />
    </div>
  );
};

