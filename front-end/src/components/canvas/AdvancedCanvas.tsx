import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Play, MousePointer, Hand, Layers, Unlink, Archive, Copy, LayoutGrid, Trash2, AlignLeft, Image as ImageIcon, Video, Scissors, Music, FileText, BoxSelect, Upload, Loader2, ChevronRight, FolderUp, FolderDown, Globe } from 'lucide-react';
import { useWorkflowStore, AppNode } from '../../stores/useCanvasStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { NodeComponent } from './NodeComponent';
import JSZip from 'jszip';
import { toast } from 'sonner';

const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const AdvancedCanvas: React.FC = () => {
  const { 
    nodes, edges, groups, updateNodePosition, addEdge, addNode, isRunning, setIsRunning, 
    updateNodeData, updateNodeType, resetRunState, selectedNodeIds, setSelectedNodeIds, 
    deleteEdge, clearCanvas, fullScreenImage, setFullScreenImage, saveSnapshot, 
    activeTool, setTool, createGroup, ungroup, duplicateNodes, setNodes, copyNodes
  } = useWorkflowStore();
  const { defaultModels } = useSettingsStore();
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [selectionRect, setSelectionRect] = useState<any>(null);
  
  const [isPanning, setIsPanning] = useState(false);
  const startPanPos = useRef({ x: 0, y: 0 });
  const isRightClickDragging = useRef(false);

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<any>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  
  const [contextMenu, setContextMenu] = useState<{ type: 'canvas' | 'node', x: number, y: number, canvasX: number, canvasY: number, nodeId?: string } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (!isInput) { e.preventDefault(); if (e.shiftKey) useWorkflowStore.getState().redo(); else useWorkflowStore.getState().undo(); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (!isInput) { e.preventDefault(); useWorkflowStore.getState().redo(); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (!isInput && useWorkflowStore.getState().selectedNodeIds.length > 0) { e.preventDefault(); copyNodes(useWorkflowStore.getState().selectedNodeIds); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (!isInput) { e.preventDefault(); saveSnapshot(); useWorkflowStore.getState().pasteNodes(-transform.x/transform.scale + 100, -transform.y/transform.scale + 100); }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!isInput && useWorkflowStore.getState().selectedNodeIds.length > 0) {
           e.preventDefault();
           saveSnapshot();
           useWorkflowStore.getState().selectedNodeIds.forEach(id => useWorkflowStore.getState().deleteNode(id));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [transform, copyNodes, saveSnapshot]);

  const getBounds = (ids: string[]) => {
    const targets = nodes.filter(n => ids.includes(n.id));
    if (targets.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    targets.forEach(n => {
      minX = Math.min(minX, n.position.x); minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + (n.width || 480)); maxY = Math.max(maxY, n.position.y + 400); 
    });
    return { x: minX - 20, y: minY - 60, w: maxX - minX + 40, h: maxY - minY + 80 };
  };

  const groupFrames = useMemo(() => groups.map(g => ({ 
    id: g.id, bounds: getBounds(g.nodeIds), isSelected: g.nodeIds.some(id => selectedNodeIds.includes(id)), nodeIds: g.nodeIds 
  })), [groups, selectedNodeIds, nodes]);

  const selectionInfo = useMemo(() => {
    if (selectedNodeIds.length < 2) return null;
    const isAnyInGroup = nodes.some(n => selectedNodeIds.includes(n.id) && n.groupId);
    if (isAnyInGroup && groups.length > 0) return null; 
    return getBounds(selectedNodeIds);
  }, [selectedNodeIds, nodes, groups]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const isCanvas = e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-bg');
    if (!isCanvas) return;
    setContextMenu(null);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    if (e.button === 2) {
        setIsPanning(true); isRightClickDragging.current = false; startPanPos.current = { x: e.clientX, y: e.clientY };
        return;
    }
    if (e.button === 0) {
        if (activeTool === 'hand') {
            setIsPanning(true); startPanPos.current = { x: e.clientX, y: e.clientY };
        } else if (activeTool === 'arrow') {
            setSelectedNodeIds([]); 
            const rect = canvasRef.current!.getBoundingClientRect();
            setSelectionRect({ x: (e.clientX - rect.left - transform.x) / transform.scale, y: (e.clientY - rect.top - transform.y) / transform.scale, w: 0, h: 0 });
        }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    if (isPanning) {
        const dx = e.clientX - startPanPos.current.x; const dy = e.clientY - startPanPos.current.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isRightClickDragging.current = true;
        setTransform(p => ({ ...p, x: p.x + dx, y: p.y + dy })); startPanPos.current = { x: e.clientX, y: e.clientY };
    } 
    else if (selectionRect && activeTool === 'arrow') {
        const cx = (e.clientX - rect.left - transform.x) / transform.scale;
        const cy = (e.clientY - rect.top - transform.y) / transform.scale;
        setSelectionRect((p: any) => ({ ...p, w: cx - p.x, h: cy - p.y }));
    }
    if (isConnecting) setMousePos({ x: (e.clientX - rect.left - transform.x) / transform.scale, y: (e.clientY - rect.top - transform.y) / transform.scale });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch(err){}
    if (e.button === 2) {
        setIsPanning(false);
        setTimeout(() => { isRightClickDragging.current = false; }, 50); // delay reset so contextmenu can read it
        return;
    }
    if (e.button === 0) {
        setIsPanning(false);
        if (selectionRect && activeTool === 'arrow') {
            const x1 = Math.min(selectionRect.x, selectionRect.x + selectionRect.w), x2 = Math.max(selectionRect.x, selectionRect.x + selectionRect.w);
            const y1 = Math.min(selectionRect.y, selectionRect.y + selectionRect.h), y2 = Math.max(selectionRect.y, selectionRect.y + selectionRect.h);
            const found = nodes.filter(n => n.position.x >= x1 && n.position.x <= x2 && n.position.y >= y1 && n.position.y <= y2).map(n => n.id);
            setSelectedNodeIds(found); setSelectionRect(null);
        }
        if (isConnecting && connectionStart) {
            const rect = canvasRef.current!.getBoundingClientRect();
            setContextMenu({ type: 'canvas', x: e.clientX, y: e.clientY, canvasX: (e.clientX - rect.left - transform.x) / transform.scale, canvasY: (e.clientY - rect.top - transform.y) / transform.scale, nodeId: connectionStart.nodeId });
            setIsConnecting(false); setConnectionStart(null); 
        }
    }
  };

  const handleContextMenuCanvas = (e: React.MouseEvent) => {
      e.preventDefault();
      if (!isRightClickDragging.current && !isConnecting) {
          const rect = canvasRef.current!.getBoundingClientRect();
          setContextMenu({ type: 'canvas', x: e.clientX, y: e.clientY, canvasX: (e.clientX - rect.left - transform.x) / transform.scale, canvasY: (e.clientY - rect.top - transform.y) / transform.scale });
      }
  };

  const handleFilesUpload = async (files: File[], dropX?: number, dropY?: number) => {
    saveSnapshot();
    const rect = canvasRef.current!.getBoundingClientRect();
    const startX = dropX !== undefined ? dropX : (window.innerWidth / 2 - rect.left - transform.x) / transform.scale;
    const startY = dropY !== undefined ? dropY : (window.innerHeight / 2 - rect.top - transform.y) / transform.scale;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const dataUrl = await readFileAsDataURL(file);
      let type: any = 'imageBox';
      let defParams: any = { prompt: '', model: defaultModels.imageGeneration, ratio: '16:9', resolution: '2K', camera: '自动', lens: '自动', focal: '自动', lensType: '标准镜头' };
      
      if (file.type.startsWith('video/')) {
        type = 'videoBox';
        defParams = { prompt: '', model: defaultModels.videoGeneration, ratio: '16:9', resolution: '1080P', duration: '4s' };
      }
      else if (file.type.startsWith('audio/')) {
        type = 'audioBox';
        defParams = { prompt: '', model: defaultModels.audioGeneration };
      }
      
      addNode({
        id: `media-${Date.now()}-${i}`,
        type,
        position: { x: startX + i*40, y: startY + i*40 },
        width: type === 'textInput' ? 320 : 480,
        data: { label: file.name, params: defParams, outputResult: dataUrl, status: 'success', mediaName: file.name }
      });
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const dropX = (e.clientX - rect.left - transform.x) / transform.scale;
    const dropY = (e.clientY - rect.top - transform.y) / transform.scale;
    handleFilesUpload(Array.from(e.dataTransfer.files), dropX, dropY);
  };

  const runWorkflow = async (targetNodeIds?: string[]) => {
      if (isRunning) return;
      setIsRunning(true);
      resetRunState();
      saveSnapshot();
      try {
        const workflowNodes = targetNodeIds ? nodes.filter(n => targetNodeIds.includes(n.id)) : nodes;
        const inDegree: Record<string, number> = {};
        const adjList: Record<string, string[]> = {};
        workflowNodes.forEach(n => { inDegree[n.id] = 0; adjList[n.id] = []; });
        edges.forEach(e => {
          if (inDegree[e.target] !== undefined && inDegree[e.source] !== undefined) {
            inDegree[e.target]++;
            adjList[e.source].push(e.target);
          }
        });
        const queue: string[] = Object.keys(inDegree).filter(id => inDegree[id] === 0);
        const sortedNodes: string[] = [];
        while (queue.length > 0) {
          const curr = queue.shift()!;
          sortedNodes.push(curr);
          adjList[curr]?.forEach(neighbor => {
            inDegree[neighbor]--;
            if (inDegree[neighbor] === 0) queue.push(neighbor);
          });
        }
        
        for (const nodeId of sortedNodes) {
          const node = useWorkflowStore.getState().nodes.find(n => n.id === nodeId)!;
          if (node.type === 'blank') continue;
          updateNodeData(nodeId, { status: 'running' });
          await new Promise(r => setTimeout(r, 1000));
          
          let result = node.data.outputResult;
          
          // Data Flow: Inherit from upstream connected image/video node if result is empty
          if (!result) {
              const incomingEdges = edges.filter(e => e.target === nodeId);
              for (const edge of incomingEdges) {
                  const sourceNode = useWorkflowStore.getState().nodes.find(n => n.id === edge.source);
                  if (sourceNode?.data.outputResult && (sourceNode.data.outputResult.startsWith('data:') || sourceNode.data.outputResult.startsWith('http'))) {
                      result = sourceNode.data.outputResult;
                      break;
                  }
              }
          }

          if (!result) {
              if (node.type === 'panorama720' || node.type === 'panorama360') {
                  // Use a fixed reliable high-res image for testing rather than Picsum which can break CORS or proportions
                  result = `https://pannellum.org/images/alma.jpg`;
              } else if (node.type === 'imageBox' || node.type === 'videoBox') {
                  result = `https://picsum.photos/seed/${nodeId}/800/600`;
              } else if (node.type === 'textInput') {
                  result = node.data.params.text || '处理完成文本';
              } else {
                  result = '处理完成';
              }
          }
          updateNodeData(nodeId, { status: 'success', outputResult: result });
        }
      } catch (err: any) {
         console.error(err);
      } finally {
         setIsRunning(false);
      }
  };

  const handleBatchDownload = async (ids: string[]) => {
    setIsBatchDownloading(true);
    try {
      const zip = new JSZip();
      const targets = nodes.filter(n => ids.includes(n.id));
      let count = 0;
      for (const node of targets) {
        if (node.data.outputResult?.startsWith('data:')) {
          const type = node.data.outputResult.split(';')[0].split(':')[1];
          const ext = type.split('/')[1] || 'png';
          const base64 = node.data.outputResult.split(',')[1];
          zip.file(`${node.data.mediaName || node.data.label}_${node.id}.${ext}`, base64, { base64: true });
          count++;
        }
      }
      if (count === 0) return alert("选中区域内没有可打包的媒体文件。");
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `AI_Assets_Export_${Date.now()}.zip`;
      link.click();
    } catch (e) {
      alert("打包失败");
    } finally {
      setIsBatchDownloading(false);
    }
  };

  const handleSaveWorkspace = async () => {
    try {
        const state = useWorkflowStore.getState();
        const exportData = {
           nodes: state.nodes,
           edges: state.edges,
           groups: state.groups,
           transform: transform
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai_workspace_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    } catch(err: any) {
        console.error('保存失败:', err);
    }
  };

  const handleLoadWorkspace = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const data = JSON.parse(text);
                if (data.nodes) {
                    useWorkflowStore.setState({
                        nodes: data.nodes,
                        edges: data.edges || [],
                        groups: data.groups || []
                    });
                    if (data.transform) setTransform(data.transform);
                } else {
                    alert('读取失败！该文件不是有效的工作区 JSON 文件。');
                }
            } catch (err) {
                alert('解析 JSON 失败或文件损坏。');
            }
        };
        reader.readAsText(file);
    };
    input.click();
  };

  const handleAutoArrange = () => {
    saveSnapshot(); 
    const currentNodes = structuredClone(nodes);
    const currentEdges = edges;
    const adj = new Map<string, string[]>();
    currentNodes.forEach(n => adj.set(n.id, []));
    currentEdges.forEach(e => {
        adj.get(e.source)?.push(e.target);
        adj.get(e.target)?.push(e.source);
    });

    const visited = new Set<string>();
    const groupsList: string[][] = [];

    currentNodes.forEach(n => {
        if (!visited.has(n.id)) {
            const group: string[] = [];
            const queue = [n.id];
            visited.add(n.id);
            while (queue.length > 0) {
                const curr = queue.shift()!;
                group.push(curr);
                adj.get(curr)?.forEach(neighbor => {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                });
            }
            groupsList.push(group);
        }
    });

    const connectedGroups = groupsList.filter(g => g.length > 1);
    const isolatedNodes = groupsList.filter(g => g.length === 1).map(g => g[0]);
    let currentY = 100;
    const startX = 100;
    const columnWidth = 380; 
    const rowHeight = 280;

    connectedGroups.forEach(group => {
        const groupEdges = currentEdges.filter(e => group.includes(e.source));
        const inDegrees = new Map<string, number>();
        group.forEach(id => inDegrees.set(id, 0));
        groupEdges.forEach(e => inDegrees.set(e.target, (inDegrees.get(e.target) || 0) + 1));
        const levels = new Map<string, number>();
        const queue: {id: string, lvl: number}[] = [];
        group.forEach(id => { if (inDegrees.get(id) === 0) queue.push({id, lvl: 0}); });
        if (queue.length === 0 && group.length > 0) queue.push({id: group[0], lvl: 0});

        while (queue.length > 0) {
            const {id, lvl} = queue.shift()!;
            if (!levels.has(id) || lvl > levels.get(id)!) {
                levels.set(id, lvl);
                currentEdges.filter(e => e.source === id).forEach(e => {
                    queue.push({id: e.target, lvl: lvl + 1});
                });
            }
        }
        const levelMap: Record<number, string[]> = {};
        group.forEach(id => {
            const l = levels.get(id) || 0;
            if (!levelMap[l]) levelMap[l] = [];
            levelMap[l].push(id);
        });

        let groupMaxHeight = 0;
        Object.keys(levelMap).forEach(lvlStr => {
            const lvl = parseInt(lvlStr);
            const ids = levelMap[lvl];
            ids.forEach((id, idx) => {
                const node = currentNodes.find(n => n.id === id)!;
                node.position = { x: startX + lvl * columnWidth, y: currentY + idx * rowHeight };
                const h = idx * rowHeight + (node.width || 320); 
                if (h > groupMaxHeight) groupMaxHeight = h;
            });
        });
        currentY += groupMaxHeight + 100; 
    });

    if (isolatedNodes.length > 0) {
        const cols = 5; 
        isolatedNodes.forEach((id, idx) => {
            const node = currentNodes.find(n => n.id === id)!;
            const r = Math.floor(idx / cols);
            const c = idx % cols;
            node.position = { x: startX + c * columnWidth, y: currentY + r * rowHeight };
        });
    }

    useWorkflowStore.getState().setNodes(currentNodes);
    setContextMenu(null);
  };

  return (
    <div className="flex-1 w-full h-full relative outline-none bg-[#0e1117] text-gray-200 overflow-hidden font-sans">
      <div className="absolute top-4 left-4 z-20 flex gap-2">
         <div className="flex bg-[#1e2029] rounded-lg p-1 border border-gray-700/80 shadow-xl">
            <button onClick={() => setTool('arrow')} className={`p-1.5 rounded ${activeTool === 'arrow' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}><MousePointer className="w-4 h-4" /></button>
            <button onClick={() => setTool('hand')} className={`p-1.5 rounded ${activeTool === 'hand' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}><Hand className="w-4 h-4" /></button>
         </div>
         <button onClick={() => runWorkflow()} disabled={isRunning} className="px-5 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-md text-sm font-bold flex items-center gap-2 shadow-xl hover:shadow-purple-500/20 transition-all"><Play className="w-4 h-4" /> 全局运行</button>
         <div className="flex gap-1 ml-2">
             <button onClick={handleLoadWorkspace} className="px-4 py-2 bg-[#1e2029] hover:bg-gray-800 rounded-md border border-gray-700/80 text-sm font-bold flex items-center gap-2 shadow-xl text-gray-300 transition-colors"><FolderDown className="w-4 h-4 text-blue-400" /> 加载工作区</button>
             <button onClick={handleSaveWorkspace} className="px-4 py-2 bg-[#1e2029] hover:bg-gray-800 rounded-md border border-gray-700/80 text-sm font-bold flex items-center gap-2 shadow-xl text-gray-300 transition-colors"><FolderUp className="w-4 h-4 text-purple-400" />保存至目录</button>
         </div>
      </div>

      <div 
        ref={canvasRef}
        className={`w-full h-full relative canvas-bg ${isPanning ? 'cursor-grabbing' : (activeTool === 'hand' ? 'cursor-grab' : 'crosshair')}`}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
        onContextMenu={handleContextMenuCanvas} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}
        onWheel={(e) => setTransform(p => ({ ...p, scale: Math.min(Math.max(0.1, p.scale + e.deltaY * -0.001), 3) }))}
      >
        <div className="absolute transform-gpu origin-top-left canvas-bg" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, minWidth: '100%', minHeight: '100%' }}>
          <div className="absolute inset-0 opacity-20 pointer-events-none canvas-bg" style={{ width: '20000px', height: '20000px', transform: 'translate(-10000px, -10000px)', backgroundImage: 'radial-gradient(circle, #8b5cf6 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
          
          <svg className="absolute overflow-visible pointer-events-none" style={{ zIndex: 0 }}>
            {edges.map(edge => {
              const sourceNode = nodes.find(n => n.id === edge.source);
              const targetNode = nodes.find(n => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;
              const startPos = { x: sourceNode.position.x + (sourceNode.width || 320), y: sourceNode.position.y + 40 };
              const endPos = { x: targetNode.position.x, y: targetNode.position.y + 40 };
              const isFlowing = isRunning && (sourceNode.data.status === 'running' || sourceNode.data.status === 'success');
              const dx = Math.abs(endPos.x - startPos.x) * 0.6;
              const d = `M ${startPos.x} ${startPos.y} C ${startPos.x + dx} ${startPos.y}, ${endPos.x - dx} ${endPos.y}, ${endPos.x} ${endPos.y}`;
              return (
                <g key={edge.id} className="group cursor-pointer pointer-events-auto" onDoubleClick={(e) => { e.stopPropagation(); saveSnapshot(); deleteEdge(edge.id); }}>
                  <path d={d} fill="none" stroke="transparent" strokeWidth="20" />
                  <path d={d} fill="none" stroke={isFlowing ? "#a855f7" : "#4b5563"} strokeWidth="3" className={`${isFlowing ? "animate-pulse" : ""} group-hover:stroke-red-500 transition-colors`} />
                </g>
              );
            })}
            {isConnecting && connectionStart && (
              <path d={`M ${connectionStart.x} ${connectionStart.y} C ${connectionStart.x + Math.abs(mousePos.x - connectionStart.x)*0.6} ${connectionStart.y}, ${mousePos.x - Math.abs(mousePos.x - connectionStart.x)*0.6} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`} fill="none" stroke="#a78bfa" strokeWidth="3" strokeDasharray="5,5" />
            )}
          </svg>

          {groupFrames.map((gf) => gf.bounds && (
             <div 
               key={gf.id} 
               className={`absolute border-2 rounded-2xl z-0 cursor-grab active:cursor-grabbing pointer-events-auto ${gf.isSelected ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'border-zinc-700/50 bg-zinc-800/5 border-dashed'}`}
               style={{ left: gf.bounds.x, top: gf.bounds.y, width: gf.bounds.w, height: gf.bounds.h }}
               onPointerDown={(e) => {
                 e.stopPropagation(); saveSnapshot(); setSelectedNodeIds(gf.nodeIds);
                 const startX = e.clientX;
                 const startY = e.clientY;
                 const initialPositions: Record<string, {x: number, y: number}> = {};
                 useWorkflowStore.getState().nodes.forEach(n => {
                     if (n.groupId === gf.id) initialPositions[n.id] = { x: n.position.x, y: n.position.y };
                 });
 
                 const onMove = (me: PointerEvent) => {
                     const dx = (me.clientX - startX) / transform.scale;
                     const dy = (me.clientY - startY) / transform.scale;
                     useWorkflowStore.setState(state => ({
                         nodes: state.nodes.map(n => 
                             n.groupId === gf.id && initialPositions[n.id] 
                             ? { ...n, position: { x: initialPositions[n.id].x + dx, y: initialPositions[n.id].y + dy } } 
                             : n
                         )
                     }));
                 };
                 
                 const onUp = () => { 
                     window.removeEventListener('pointermove', onMove); 
                     window.removeEventListener('pointerup', onUp); 
                     window.removeEventListener('pointercancel', onUp);
                 };
                 
                 window.addEventListener('pointermove', onMove); 
                 window.addEventListener('pointerup', onUp);
                 window.addEventListener('pointercancel', onUp);
               }}
             >
               {gf.isSelected && (
                 <div className="absolute -top-12 left-0 flex gap-2 pointer-events-auto" onPointerDown={e => e.stopPropagation()}>
                    <button onClick={() => { saveSnapshot(); ungroup(gf.id); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-bold shadow-lg hover:bg-orange-500 transition-colors"><Unlink className="w-3.5 h-3.5" /> 解组</button>
                    <button onClick={() => handleBatchDownload(gf.nodeIds)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-gray-200 rounded-lg text-xs font-bold border border-gray-700 shadow-xl hover:bg-gray-700 transition-colors">{isBatchDownloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3.5 h-3.5" />} 批量打包下载</button>
                    <button onClick={() => runWorkflow(gf.nodeIds)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold shadow-lg hover:bg-green-500 transition-colors"><Play className="w-3.5 h-3.5" /> 整组执行</button>
                    <button onClick={() => { saveSnapshot(); const ids = [...gf.nodeIds]; ungroup(gf.id); ids.forEach(id => useWorkflowStore.getState().deleteNode(id)); setSelectedNodeIds([]); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold shadow-lg hover:bg-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /> 删除</button>
                 </div>
               )}
             </div>
          ))}

          {selectionInfo && (
            <div className="absolute border-2 border-purple-500/50 border-dashed bg-purple-500/5 rounded-2xl pointer-events-none z-0" style={{ left: selectionInfo.x, top: selectionInfo.y, width: selectionInfo.w, height: selectionInfo.h }}>
               <div className="absolute -top-12 left-0 flex gap-2 pointer-events-auto">
                  <button onClick={() => { saveSnapshot(); createGroup(selectedNodeIds); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-lg transition-colors"><Layers className="w-3.5 h-3.5" /> 打组</button>
                  <button onClick={() => handleBatchDownload(selectedNodeIds)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-bold border border-gray-700 shadow-lg hover:bg-gray-700 transition-colors"><Archive className="w-3.5 h-3.5"/> 批量下载</button>
                  <button onClick={() => { saveSnapshot(); duplicateNodes(selectedNodeIds); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-bold border border-gray-700 shadow-lg hover:bg-gray-700 transition-colors"><Copy className="w-3.5 h-3.5" /> 生成副本</button>
                  <button onClick={() => { saveSnapshot(); selectedNodeIds.forEach(id => useWorkflowStore.getState().deleteNode(id)); setSelectedNodeIds([]); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /> 删除</button>
               </div>
            </div>
          )}

          {nodes.map(node => (
            <NodeComponent 
              key={node.id} node={node} scale={transform.scale}
              isSelected={selectedNodeIds.includes(node.id)}
              onSelect={(append: boolean) => {
                  if (node.groupId) setSelectedNodeIds(nodes.filter(n => n.groupId === node.groupId).map(n => n.id));
                  else setSelectedNodeIds(append ? [...selectedNodeIds, node.id] : [node.id]);
              }}
              onDrag={(id: string, x: number, y: number) => updateNodePosition(id, { x, y })}
              onStartConnect={(e: React.PointerEvent) => {
                setIsConnecting(true);
                const rect = canvasRef.current!.getBoundingClientRect();
                setConnectionStart({ nodeId: node.id, x: (e.clientX - rect.left - transform.x) / transform.scale, y: (e.clientY - rect.top - transform.y) / transform.scale });
              }}
              onEndConnect={() => {
                if (isConnecting && connectionStart && connectionStart.nodeId !== node.id) {
                  saveSnapshot(); addEdge({ id: `edge-${Date.now()}`, source: connectionStart.nodeId, target: node.id });
                }
                setIsConnecting(false); setConnectionStart(null);
              }}
              onRunNode={() => runWorkflow([node.id])}
              onContextMenu={(e: React.MouseEvent) => {
                  e.preventDefault(); e.stopPropagation();
                  if (!selectedNodeIds.includes(node.id)) setSelectedNodeIds([node.id]);
                  setContextMenu({ type: 'node', nodeId: node.id, x: e.clientX, y: e.clientY, canvasX: 0, canvasY: 0 });
              }}
            />
          ))}
          
          {selectionRect && (
             <div className="absolute border-2 border-purple-500 bg-purple-500/10 pointer-events-none z-50" style={{ left: Math.min(selectionRect.x, selectionRect.x + selectionRect.w), top: Math.min(selectionRect.y, selectionRect.y + selectionRect.h), width: Math.abs(selectionRect.w), height: Math.abs(selectionRect.h) }} />
          )}
        </div>
      </div>

      {contextMenu && (
        <div id="context-menu" className="fixed z-50 bg-[#282a36] border border-gray-700 rounded-xl shadow-2xl w-48 flex flex-col py-1 pointer-events-auto" style={{ top: contextMenu.y, left: contextMenu.x }}>
            <>
              <input type="file" className="hidden" ref={fileInputRef} multiple onChange={(e) => {
                 if (e.target.files && e.target.files.length > 0) {
                     handleFilesUpload(Array.from(e.target.files), contextMenu.canvasX, contextMenu.canvasY);
                     setContextMenu(null);
                 }
              }}/>
              
              <div className="relative group/addnode">
                  <button className="w-full text-left px-4 py-2.5 hover:bg-gray-700/50 text-sm text-gray-200 flex items-center justify-between transition-colors">
                      <div className="flex items-center gap-3"><Layers className="w-4 h-4 text-gray-400" /> 添加节点</div>
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                  <div className="absolute left-full top-0 ml-1 hidden group-hover/addnode:flex flex-col bg-[#282a36] border border-gray-700 shadow-2xl rounded-xl w-48 py-1">
                      <button onClick={() => { saveSnapshot(); addNode({ id: `node-${Date.now()}`, type: 'textInput', position: { x: contextMenu.canvasX, y: contextMenu.canvasY }, width: 320, data: { label: '文本', params: { text: '' }, status: 'idle' } }); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-700/50 text-sm text-gray-200 flex items-center gap-3 transition-colors"><AlignLeft className="w-4 h-4 text-gray-400" /> 文本</button>
                      <button onClick={() => { saveSnapshot(); addNode({ id: `node-${Date.now()}`, type: 'imageBox', position: { x: contextMenu.canvasX, y: contextMenu.canvasY }, width: 480, data: { label: '图片', params: { prompt: '', model: defaultModels.imageGeneration, ratio: '16:9', resolution: '2K', camera: '自动', lens: '自动', focal: '自动', lensType: '标准镜头' }, status: 'idle' } }); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-700/50 text-sm text-gray-200 flex items-center gap-3 transition-colors"><ImageIcon className="w-4 h-4 text-gray-400" /> 图片</button>
                      <button onClick={() => { saveSnapshot(); addNode({ id: `node-${Date.now()}`, type: 'videoBox', position: { x: contextMenu.canvasX, y: contextMenu.canvasY }, width: 480, data: { label: '视频', params: { prompt: '', model: defaultModels.videoGeneration, ratio: '16:9', resolution: '1080P', duration: '4s' }, status: 'idle' } }); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-700/50 text-sm text-gray-200 flex items-center gap-3 transition-colors"><Video className="w-4 h-4 text-gray-400" /> 视频</button>
                      <button onClick={() => { saveSnapshot(); addNode({ id: `node-${Date.now()}`, type: 'audioBox', position: { x: contextMenu.canvasX, y: contextMenu.canvasY }, width: 320, data: { label: '音频', params: { prompt: '', model: defaultModels.audioGeneration }, status: 'idle' } }); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-700/50 text-sm text-gray-200 flex items-center gap-3 transition-colors"><Music className="w-4 h-4 text-gray-400" /> 音频</button>
                      <button onClick={() => { saveSnapshot(); addNode({ id: `node-${Date.now()}`, type: 'videoSynth', position: { x: contextMenu.canvasX, y: contextMenu.canvasY }, width: 480, data: { label: '视频编排', params: {}, status: 'idle' } }); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-700/50 text-sm text-gray-200 flex items-center gap-3 transition-colors"><Scissors className="w-4 h-4 text-gray-400" /> 视频编排</button>
                      <button onClick={() => { saveSnapshot(); addNode({ id: `node-${Date.now()}`, type: 'panorama720', position: { x: contextMenu.canvasX, y: contextMenu.canvasY }, width: 480, data: { label: '全景 720°', params: { prompt: '', model: defaultModels.imageGeneration, ratio: '2:1', resolution: '4K' }, status: 'idle' } }); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-700/50 text-sm text-gray-200 flex items-center gap-3 transition-colors"><Globe className="w-4 h-4 text-blue-400" /> 球形全景(720)</button>
                      <button onClick={() => { saveSnapshot(); addNode({ id: `node-${Date.now()}`, type: 'panorama360', position: { x: contextMenu.canvasX, y: contextMenu.canvasY }, width: 480, data: { label: '全景 360°', params: { prompt: '', model: defaultModels.imageGeneration, ratio: '2:1', resolution: '4K' }, status: 'idle' } }); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-700/50 text-sm text-gray-200 flex items-center gap-3 transition-colors"><Globe className="w-4 h-4 text-green-400" /> 圆柱形全景(360)</button>
                  </div>
              </div>

              {contextMenu.nodeId && ['panorama720', 'panorama360'].includes(nodes.find(n => n.id === contextMenu.nodeId)?.type || '') && selectedNodeIds.length > 0 && nodes.find(n => n.id === selectedNodeIds[0] && n.type === 'imageBox' && n.data.outputResult) && (
                  <button onClick={() => {
                      saveSnapshot();
                      const sourceNode = nodes.find(n => n.id === selectedNodeIds[0]);
                      if (sourceNode && sourceNode.data.outputResult) {
                          updateNodeData(contextMenu.nodeId!, { 
                              outputResult: sourceNode.data.outputResult,
                              status: 'success'
                          });
                          toast.success('已应用所选图片作为全景图源');
                      }
                      setContextMenu(null);
                  }} className="w-full text-left px-4 py-2.5 hover:bg-green-600/20 text-sm text-green-400 flex items-center gap-3 transition-colors">
                      <ImageIcon className="w-4 h-4" /> 应用所选图片到此全景节点
                  </button>
              )}

              {contextMenu.nodeId && nodes.find(n => n.id === contextMenu.nodeId)?.type === 'imageBox' && (
                  <button onClick={() => {
                      saveSnapshot();
                      const node = nodes.find(n => n.id === contextMenu.nodeId);
                      if (node) {
                          updateNodeType(node.id, 'panorama720');
                          updateNodeData(node.id, { 
                              params: { ...node.data.params, isPerfectPanorama: true, ratio: '2:1' },
                              label: '球形全景(720)'
                          });
                      }
                      setContextMenu(null);
                  }} className="w-full text-left px-4 py-2.5 hover:bg-blue-600/20 text-sm text-blue-400 flex items-center gap-3 transition-colors">
                      <Globe className="w-4 h-4" /> 转换为全景视图
                  </button>
              )}

              <div className="relative group/upload">
                  <button className="w-full text-left px-4 py-2.5 hover:bg-gray-700/50 text-sm text-gray-200 flex items-center justify-between transition-colors">
                      <div className="flex items-center gap-3"><Upload className="w-4 h-4 text-gray-400" /> 上传资源</div>
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                  <div className="absolute left-full top-0 ml-1 hidden group-hover/upload:flex flex-col bg-[#282a36] border border-gray-700 shadow-2xl rounded-xl w-40 py-1">
                      <button onClick={() => { fileInputRef.current?.click(); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-700/50 text-sm text-gray-200 flex items-center gap-3 transition-colors"><Upload className="w-4 h-4 text-gray-400" /> 上传文件</button>
                  </div>
              </div>

              <div className="h-px bg-gray-700/50 my-1 mx-2"></div>
              
              <button onClick={() => { handleAutoArrange(); setContextMenu(null); }} className="w-full text-left px-4 py-2.5 hover:bg-gray-700/50 flex items-center gap-3 text-sm transition-colors text-gray-300">
                 <LayoutGrid className="w-4 h-4 text-blue-400" /> <span>智能整理布局</span>
              </button>
              
              <button onClick={() => { saveSnapshot(); clearCanvas(); setContextMenu(null); }} className="w-full text-left px-4 py-2.5 hover:bg-red-500/10 flex items-center gap-3 text-sm transition-colors text-red-400">
                 <Trash2 className="w-4 h-4" /> <span>清空画布</span>
              </button>
            </>
        </div>
      )}

      {fullScreenImage && <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-8 cursor-zoom-out" onClick={() => setFullScreenImage(null)}><img src={fullScreenImage} className="max-w-full max-h-full object-contain" /></div>}
    </div>
  );
}
