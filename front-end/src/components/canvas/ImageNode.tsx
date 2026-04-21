import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ImageIcon, X } from 'lucide-react';
import { useProjectStore } from '../../stores/useProjectStore';

export const ImageNode = memo(({ id, data, selected }: NodeProps) => {
  const currentProjectId = useProjectStore(s => s.currentProjectId);
  const setCanvasElements = useProjectStore(s => s.setCanvasElements);
  const projects = useProjectStore(s => s.projects);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentProjectId) return;
    const project = projects[currentProjectId];
    const nodes = (project.canvasNodes || []).filter(n => n.id !== id);
    const edges = (project.canvasEdges || []).filter(e => e.source !== id && e.target !== id);
    setCanvasElements(nodes, edges);
  };

  return (
    <div className={`relative group min-w-[200px] bg-card border ${selected ? 'border-primary shadow-[0_0_15px_rgba(var(--color-primary),0.3)]' : 'border-secondary'} transition-all`}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-primary border-none" />
      
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-secondary flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-3 h-3 text-primary" />
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider truncate max-w-[120px]">
            {data.label || '图像资产'}
          </span>
        </div>
        <button 
          onClick={handleDelete}
          className="p-1 hover:text-destructive text-muted-foreground transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Content */}
      <div className="p-2">
        {data.imageUrl ? (
          <img 
            src={data.imageUrl} 
            alt={data.label} 
            className="w-full max-w-[200px] max-h-[300px] object-contain border border-secondary/50"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="aspect-video bg-muted/20 flex items-center justify-center border border-dashed border-secondary">
            <span className="text-[10px] font-mono text-muted-foreground italic">无图像预览</span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-primary border-none" />
    </div>
  );
});

ImageNode.displayName = 'ImageNode';
