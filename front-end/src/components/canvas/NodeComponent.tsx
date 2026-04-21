import React, { useState, useRef, useEffect } from 'react';
import { Camera, LayoutGrid, ChevronDown, Video, Image as ImageIcon, Edit3, Maximize2, Download, Loader2, AlertCircle, Cloud, ArrowUp, MoreHorizontal, Copy, Trash2, Crop, Library, Eraser, AlignLeft, X, Globe, Camera as CameraIcon, Upload, Wand2, Film, GripVertical, Scissors, Music } from 'lucide-react';
import { useWorkflowStore, AppNode } from '../../stores/useCanvasStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { Plugin720Viewer, Plugin360Viewer, extractPanoramaViews } from './PanoramaPlugins';
import { synthesizeVideo } from '../../lib/videoSynth';
import { toast } from 'sonner';

const imageRatios = [{ r: '自适应', w: 14, h: 14, dash: true }, { r: '1:1', w: 14, h: 14 }, { r: '9:16', w: 10, h: 18 }, { r: '16:9', w: 18, h: 10 }, { r: '3:4', w: 12, h: 16 }, { r: '4:3', w: 16, h: 12 }, { r: '3:2', w: 16, h: 11 }, { r: '2:3', w: 11, h: 16 }, { r: '4:5', w: 12, h: 15 }, { r: '5:4', w: 15, h: 12 }, { r: '21:9', w: 22, h: 9 }];
const videoRatios = [{ r: '16:9', w: 18, h: 10 }, { r: '9:16', w: 10, h: 18 }, { r: '1:1', w: 14, h: 14 }, { r: '4:3', w: 16, h: 12 }, { r: '3:4', w: 12, h: 16 }];
const cameraBodies = ["自动", "佳能 EOS R5", "Red V-Raptor 8K数字电影机", "索尼 Venice 电影摄影机", "阿莱 Alexa 35 电影摄影机", "Panavision DXL2 电影机", "IMAX 胶片摄影机", "索尼 A7IV", "尼康 Z9", "富士 GFX100", "哈苏 X2D", "徕卡 M11"];
const lenses = ["自动", "Panavision C系列电影镜头", "Helios 44-2 镜头", "佳能 K-35 电影镜头组", "Cooke S4 电影镜头", "阿莱签名定焦镜头", "蔡司超级定焦镜头"];
const focals = ["自动", "8mm", "14mm", "24mm", "35mm", "50mm", "85mm"];
const lensTypes = ["标准镜头", "广角镜头", "长焦镜头", "特写镜头", "俯视镜头", "仰视镜头", "鱼眼镜头", "微距镜头"];

export function NodeComponent({ node, scale, isSelected, onSelect, onDrag, onStartConnect, onEndConnect, onRunNode, onContextMenu }: any) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const initialPos = useRef({ x: 0, y: 0 });
  const { updateNodeData, setFullScreenImage, saveSnapshot, edges, nodes, addNode, deleteNode, copyNodes, duplicateNodes, updateNodePosition } = useWorkflowStore();
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const [mentionMenu, setMentionMenu] = useState<{ show: boolean, query: string, index: number, options: AppNode[] } | null>(null);

  const prevStatus = useRef(node.data.status);
  useEffect(() => {
      if (prevStatus.current === 'running' && node.data.status === 'success') {
          setIsEditing(false);
      }
      prevStatus.current = node.data.status;
  }, [node.data.status]);

  useEffect(() => {
    const closePops = () => setActivePopover(null);
    window.addEventListener('pointerdown', closePops);
    return () => window.removeEventListener('pointerdown', closePops);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName.toLowerCase() === 'textarea' || target.tagName.toLowerCase() === 'input' || target.closest('button') || target.tagName.toLowerCase() === 'select' || target.closest('.popover-container')) {
      onSelect(e.shiftKey || e.ctrlKey); return;
    }
    e.stopPropagation(); saveSnapshot();
    setIsDragging(true); onSelect(e.shiftKey || e.ctrlKey);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    initialPos.current = { x: node.position.x, y: node.position.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const getConnectedMediaNodes = () => {
    // 获取所有上游节点（source -> target 方向）
    const upstream = new Set<string>();
    const queue = [node.id];
    const visited = new Set<string>();
    visited.add(node.id);

    while(queue.length > 0) {
        const curr = queue.shift()!;
        edges.forEach(e => {
            // 只追踪上游：如果当前节点是 target，则 source 是上游
            if (e.target === curr && !visited.has(e.source)) {
                visited.add(e.source);
                queue.push(e.source);
                upstream.add(e.source);
            }
        });
    }

    // 返回所有上游的图片和视频节点，且必须有 label
    return nodes.filter(n =>
      upstream.has(n.id) &&
      (n.type === 'imageBox' || n.type === 'videoBox') &&
      n.data.label
    );
  };

  const currentVal = node.type === 'textInput' ? node.data.params.text : node.data.params.prompt;

  const [cursorPosition, setCursorPosition] = React.useState(0);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;
    setCursorPosition(cursorPos);

    if (node.type === 'textInput') updateNodeData(node.id, { params: { ...node.data.params, text: val } });
    else updateNodeData(node.id, { params: { ...node.data.params, prompt: val } });

    const textBeforeCursor = val.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([^\s\]]*)$/);

    if (match) {
      const query = match[1].toLowerCase();
      const allUpstream = getConnectedMediaNodes();

      // 如果有查询词，则过滤；否则显示所有上游节点
      const filteredNodes = query
        ? allUpstream.filter(n =>
            (n.data.label || '').toLowerCase().includes(query) ||
            (n.data.mediaName || '').toLowerCase().includes(query)
          )
        : allUpstream;

      if (filteredNodes.length > 0) {
         setMentionMenu({ show: true, query, index: 0, options: filteredNodes });
      } else {
         setMentionMenu(null);
      }
    } else {
      setMentionMenu(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
     if (mentionMenu && mentionMenu.show) {
        console.log('Key pressed:', e.key, 'Menu options:', mentionMenu.options.length, 'Current index:', mentionMenu.index);
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setMentionMenu({ ...mentionMenu, index: (mentionMenu.index + 1) % mentionMenu.options.length });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setMentionMenu({ ...mentionMenu, index: (mentionMenu.index - 1 + mentionMenu.options.length) % mentionMenu.options.length });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            console.log('Enter pressed, applying mention for:', mentionMenu.options[mentionMenu.index]);
            applyMention(mentionMenu.options[mentionMenu.index]);
        } else if (e.key === 'Escape') {
            setMentionMenu(null);
        }
     }
  };

  const applyMention = (selNode: AppNode) => {
    const val = currentVal || '';
    const textBeforeCursor = val.slice(0, cursorPosition);
    const match = textBeforeCursor.match(/@([^\s\]]*)$/);
    if (!match) return;

    // 获取标签名称
    const labelName = selNode.data.label || selNode.data.mediaName || '未命名';
    // 根据节点类型添加扩展名
    const extension = selNode.type === 'imageBox' ? '.png' : '.mp4';
    const fullName = `${labelName}${extension}`;

    const newVal = val.slice(0, match.index) + `@[${fullName}] ` + val.slice(cursorPosition);

    if (node.type === 'textInput') updateNodeData(node.id, { params: { ...node.data.params, text: newVal } });
    else updateNodeData(node.id, { params: { ...node.data.params, prompt: newVal } });
    setMentionMenu(null);
  };

  const performImageSplit = async (src: string, rows: number, cols: number) => {
    const img = new Image(); img.src = src;
    img.onload = () => {
      saveSnapshot();
      const sw = img.width / cols, sh = img.height / rows;
      for(let r=0; r<rows; r++) {
        for(let c=0; c<cols; c++) {
          const canvas = document.createElement('canvas'); canvas.width = sw; canvas.height = sh;
          canvas.getContext('2d')?.drawImage(img, c*sw, r*sh, sw, sh, 0, 0, sw, sh);
          addNode({ id: `spl-${Date.now()}-${r}-${c}`, type: 'imageBox', position: { x: node.position.x + (node.width||480) + c*200, y: node.position.y + r*200 + (node.height||200) + 50 }, width: 320, data: { label: `切片 ${r+1}x${c+1}`, params: { prompt: '', model: node.data.params.model, ratio: node.data.params.ratio, resolution: node.data.params.resolution, camera: '自动', lens: '自动', focal: '自动', lensType: '标准镜头' }, outputResult: canvas.toDataURL(), status: 'success' } });
        }
      }
    };
  };

  return (
    <div
      className={`absolute rounded-2xl border bg-[#1c1e26] shadow-2xl flex flex-col ${isSelected ? 'ring-2 ring-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)] z-[100]' : 'border-gray-700/80 hover:border-gray-500 z-10'} ${node.groupId ? 'border-l-4 border-l-blue-500' : ''} cursor-grab active:cursor-grabbing pb-2`}
      style={{ left: node.position.x, top: node.position.y, width: node.width || 320 }}
      onPointerDown={handlePointerDown}
      onPointerMove={(e) => { if(isDragging) onDrag(node.id, initialPos.current.x + (e.clientX - dragStartPos.current.x)/scale, initialPos.current.y + (e.clientY - dragStartPos.current.y)/scale); }}
      onPointerUp={() => setIsDragging(false)}
      onPointerCancel={() => setIsDragging(false)}
      onDragStart={(e) => e.preventDefault()}
      onContextMenu={(e) => {
          e.preventDefault();
          setActivePopover(activePopover === 'menu' ? null : 'menu');
      }}
    >
      {/* 悬浮名称标签 */}
      {node.data.label && (
        <div className="absolute -top-2.5 left-3 z-30 px-2.5 py-0.5 bg-cyan-500/90 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-cyan-500/20 pointer-events-none whitespace-nowrap max-w-[220px] overflow-hidden text-ellipsis rounded-sm backdrop-blur-sm">
          {node.data.label}
        </div>
      )}

      <div className="absolute -left-3 top-6 w-6 h-6 rounded-full bg-gray-800 border-2 border-gray-500 flex items-center justify-center cursor-crosshair hover:scale-125 transition-all z-20" onPointerUp={(e) => { e.stopPropagation(); onEndConnect(); }}><div className="w-2 h-2 rounded-full bg-gray-400" /></div>
      <div className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-gray-800 border-2 border-purple-500 flex items-center justify-center cursor-crosshair hover:scale-125 transition-all z-20" onPointerDown={(e) => { e.stopPropagation(); onStartConnect(e); }}><div className="w-2 h-2 rounded-full bg-purple-400" /></div>

      {activePopover === 'menu' && (
          <div className="absolute left-1/2 -top-10 -translate-x-1/2 bg-[#282a36] shadow-2xl border border-gray-700 rounded-lg flex z-[80] pointer-events-auto h-8 items-center px-1" onPointerDown={e => { e.stopPropagation(); }}>
              <button onPointerDown={(e) => { e.stopPropagation(); saveSnapshot(); copyNodes([node.id]); setActivePopover(null); }} className="px-3 hover:bg-gray-700/50 h-full text-xs text-gray-200 flex items-center gap-1.5 whitespace-nowrap rounded"><Copy className="w-3.5 h-3.5 text-gray-400" /> 复制</button>
              <button onPointerDown={(e) => { e.stopPropagation(); saveSnapshot(); duplicateNodes([node.id]); setActivePopover(null); }} className="px-3 hover:bg-gray-700/50 h-full text-xs text-gray-200 flex items-center gap-1.5 whitespace-nowrap rounded"><Copy className="w-3.5 h-3.5 text-gray-400" /> 创建副本</button>
              <div className="w-px h-4 bg-gray-700/50 mx-1"></div>
              <button onPointerDown={(e) => { e.stopPropagation(); saveSnapshot(); updateNodeData(node.id, { outputResult: undefined, params: { ...node.data.params, prompt: '', text: '' } }); setActivePopover(null); }} className="px-3 hover:bg-gray-700/50 h-full text-xs text-orange-400 flex items-center gap-1.5 whitespace-nowrap rounded"><Eraser className="w-3.5 h-3.5" /> 清空</button>
              <div className="w-px h-4 bg-gray-700/50 mx-1"></div>
              <button onPointerDown={(e) => { e.stopPropagation(); saveSnapshot(); deleteNode(node.id); setActivePopover(null); }} className="px-3 hover:bg-red-500/10 h-full text-xs text-red-400 flex items-center gap-1.5 whitespace-nowrap rounded"><Trash2 className="w-3.5 h-3.5" /> 删除</button>
          </div>
      )}

      {node.type !== 'panorama720' && node.type !== 'panorama360' && node.type !== 'videoSynth' && ( // Added conditional back to only show this wrapper div if needed
        <div className="p-3 relative flex flex-col gap-3 pointer-events-auto mt-2">
        {(node.type === 'textInput' || node.type === 'imageBox' || node.type === 'videoBox' || node.type === 'audioBox') && (!node.data.outputResult || (node.type === 'imageBox' && !node.data.outputResult.startsWith('data:image') && !node.data.outputResult.startsWith('http')) || (node.type === 'videoBox' && !node.data.outputResult.startsWith('data:video') && !node.data.outputResult.startsWith('http') && !node.data.outputResult.startsWith('blob:')) || (node.type === 'audioBox' && !node.data.outputResult.startsWith('data:audio') && !node.data.outputResult.startsWith('http') && !node.data.outputResult.startsWith('blob:')) || isEditing || node.data.status === 'error') && (
           <div className={`relative order-2 ${node.type === 'textInput' ? 'w-full' : 'flex flex-col gap-2 bg-[#13151a] p-2 rounded-xl border border-gray-800 shadow-inner'}`} onClick={e => e.stopPropagation()}>
               <textarea 
                  className={`w-full bg-transparent text-sm text-gray-200 outline-none resize-none placeholder-gray-600 ${node.type === 'textInput' ? 'bg-[#16181f] border border-gray-700/50 rounded-xl p-3 h-32 focus:border-blue-500 overflow-y-auto' : 'h-[72px] p-2 overflow-y-auto max-h-[120px]'}`} 
                  placeholder={node.type === 'textInput' ? '输入内容... 键入 @ 关联上下文资源' : node.type === 'audioBox' ? '描述想要生成的音频或音色...' : '描述想要生成的内容... 键入 @ 关联上下文资源'} 
                  value={currentVal || ''} onFocus={() => saveSnapshot()} onChange={handleTextChange} onKeyDown={handleKeyDown} onPointerDown={e => e.stopPropagation()} 
               />
               
               {mentionMenu && mentionMenu.show && (
                   <div className="absolute top-full left-0 mt-1 w-full bg-[#282a36] border border-gray-700 rounded-lg shadow-2xl z-[100]" onPointerDown={e => e.stopPropagation()}>
                       <div className="px-3 py-1.5 text-xs text-blue-400 bg-blue-900/20 font-bold border-b border-gray-800">
                         关联上游资产 ({mentionMenu.options.length})
                       </div>
                       {mentionMenu.options.length === 0 ? (
                         <div className="px-3 py-2 text-xs text-gray-500 text-center">
                           无可用上游资产
                         </div>
                       ) : (
                         <div className="max-h-[200px] overflow-y-auto">
                           {mentionMenu.options.map((opt, i) => {
                             const labelName = opt.data.label || opt.data.mediaName || '未命名';
                             const extension = opt.type === 'imageBox' ? '.png' : '.mp4';
                             return (
                               <div
                                 key={opt.id}
                                 onClick={() => applyMention(opt)}
                                 className={`px-3 py-2 text-xs flex justify-between cursor-pointer border-b border-gray-800/50 last:border-0 ${i === mentionMenu.index ? 'bg-purple-600/30 text-white' : 'text-gray-300 hover:bg-gray-700/50'}`}
                               >
                                 <span className="truncate flex-1">{labelName}{extension}</span>
                                 <span className="text-gray-500 ml-2">[{opt.type === 'imageBox'?'图片':'视频'}]</span>
                               </div>
                             );
                           })}
                         </div>
                       )}
                   </div>
               )}

               {node.type !== 'textInput' && (
                 <div className="flex items-center justify-between bg-[#1e2029] p-1.5 rounded-lg border border-gray-700/50 gap-2 relative overflow-hidden">
                    <div className="flex items-center gap-1 popover-container flex-1 min-w-0 overflow-hidden">
                        <div className="relative group/model">
                           <div className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-gray-700/50 rounded cursor-pointer transition-colors">
                              {node.type === 'imageBox' ? <Cloud className="w-3.5 h-3.5 text-purple-400" /> : node.type === 'audioBox' ? <Music className="w-3.5 h-3.5 text-orange-400" /> : <Video className="w-3.5 h-3.5 text-red-400" />}
                              <ModelSelector node={node} />
                           </div>
                        </div>

                        {node.type !== 'audioBox' && (
                        <>
                        <div className="relative">
                            <button 
                               className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-gray-700/50 rounded text-xs font-bold text-gray-300 transition-colors"
                               onClick={(e) => { e.stopPropagation(); setActivePopover(activePopover === 'ratio' ? null : 'ratio'); }}
                               onPointerDown={e => e.stopPropagation()}
                            >
                               <LayoutGrid className="w-3.5 h-3.5 text-gray-400" /> {node.data.params.ratio || '2:1'} · {node.data.params.resolution} <ChevronDown className="w-3 h-3 text-gray-500" />
                            </button>
                            {activePopover === 'ratio' && (node.type === 'imageBox' || node.type === 'panoramaBox') && (
                                <div className="absolute bottom-full left-0 mb-2 w-[340px] bg-[#1c1e26] border border-gray-700/80 shadow-2xl rounded-2xl p-4 z-[90] cursor-default" onPointerDown={e => e.stopPropagation()}>
                                    <div className="flex gap-2 p-1 bg-[#13151a] rounded-lg border border-gray-800 mb-4">
                                        {['1K', '2K', '4K'].map(res => (
                                            <button 
                                              key={res} 
                                              className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors ${node.data.params.resolution === res ? 'bg-[#3b3e46] text-white shadow-inner' : 'text-gray-400 hover:bg-gray-800/50'}`}
                                              onClick={() => updateNodeData(node.id, { params: { ...node.data.params, resolution: res } })}
                                            >
                                              {res}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-5 gap-2">
                                        {imageRatios.map(item => (
                                            <button 
                                                key={item.r}
                                                className={`flex flex-col items-center justify-center gap-1.5 py-1.5 rounded-lg border border-transparent hover:bg-gray-800/50 transition-colors ${node.data.params.ratio === item.r ? 'bg-gray-800/80 border-gray-700/80 shadow-inner' : ''}`}
                                                onClick={() => updateNodeData(node.id, { params: { ...node.data.params, ratio: item.r } })}
                                            >
                                                <div className="w-6 h-6 flex items-center justify-center">
                                                    <div className={`border-[1.5px] ${item.r === node.data.params.ratio ? 'border-purple-400' : 'border-gray-500'} ${item.dash ? 'border-dashed' : ''} rounded-sm`} style={{ width: item.w, height: item.h }} />
                                                </div>
                                                <span className={`text-[10px] ${item.r === node.data.params.ratio ? 'text-purple-400 font-bold' : 'text-gray-500'}`}>{item.r}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activePopover === 'ratio' && node.type === 'videoBox' && (
                                <div className="absolute bottom-full left-0 mb-2 w-[300px] bg-[#1c1e26] border border-gray-700/80 shadow-2xl rounded-2xl p-4 z-[90] cursor-default" onPointerDown={e => e.stopPropagation()}>
                                    <div className="grid grid-cols-5 gap-2 mb-4">
                                        {videoRatios.map(item => (
                                            <button 
                                                key={item.r}
                                                className={`flex flex-col items-center justify-center gap-1.5 py-1.5 rounded-lg border border-transparent hover:bg-gray-800/50 transition-colors ${node.data.params.ratio === item.r ? 'bg-gray-800/80 border-gray-700/80 shadow-inner' : ''}`}
                                                onClick={() => updateNodeData(node.id, { params: { ...node.data.params, ratio: item.r } })}
                                            >
                                                <div className="w-6 h-6 flex items-center justify-center">
                                                    <div className={`border-[1.5px] ${item.r === node.data.params.ratio ? 'border-purple-400' : 'border-gray-500'} rounded-sm`} style={{ width: item.w, height: item.h }} />
                                                </div>
                                                <span className={`text-[10px] ${item.r === node.data.params.ratio ? 'text-purple-400 font-bold' : 'text-gray-500'}`}>{item.r}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2 p-1 bg-[#13151a] rounded-lg border border-gray-800 mb-4">
                                        {['720P', '1080P'].map(res => (
                                            <button 
                                              key={res} 
                                              className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors ${node.data.params.resolution === res ? 'bg-[#3b3e46] text-white shadow-inner' : 'text-gray-400 hover:bg-gray-800/50'}`}
                                              onClick={() => updateNodeData(node.id, { params: { ...node.data.params, resolution: res } })}
                                            >
                                              {res}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between border-t border-gray-800/80 pt-3 mt-1">
                                         <span className="text-xs font-bold text-gray-400">视频时长</span>
                                         <select className="bg-[#13151a] border border-gray-700/50 rounded-lg px-2 py-1 cursor-pointer text-xs font-bold text-gray-200 outline-none hover:border-blue-500" value={node.data.params.duration} onChange={(e) => updateNodeData(node.id, { params: { ...node.data.params, duration: e.target.value }})}>
                                             <option value="4s">4s</option>
                                             <option value="8s">8s</option>
                                             <option value="12s">12s</option>
                                         </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {(node.type === 'imageBox' || node.type === 'panoramaBox') && (
                            <div className="relative">
                                <button 
                                   className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-gray-700/50 rounded text-xs font-bold text-gray-300 transition-colors"
                                   onClick={(e) => { e.stopPropagation(); setActivePopover(activePopover === 'camera_settings' ? null : 'camera_settings'); }}
                                   onPointerDown={e => e.stopPropagation()}
                                >
                                   <Camera className="w-3.5 h-3.5 text-blue-400" /> 相机 <ChevronDown className="w-3 h-3 text-gray-500" />
                                </button>
                                {activePopover === 'camera_settings' && (
                                    <div className="absolute bottom-full left-1/2 -ml-[210px] mb-2 w-[420px] bg-[#1c1e26] border border-gray-700/80 shadow-2xl rounded-2xl p-4 z-[90] cursor-default" onPointerDown={e => e.stopPropagation()}>
                                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-800">
                                            <div className="flex items-center gap-2"><Camera className="w-4 h-4 text-blue-400" /><span className="text-sm font-bold text-gray-200">相机设置</span></div>
                                            <button onClick={() => setActivePopover(null)} className="text-gray-500 hover:text-white transition-colors p-1 rounded-md hover:bg-gray-800"><X className="w-4 h-4" /></button>
                                        </div>
                                        <div className="grid grid-cols-4 gap-3 mb-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[10px] text-gray-500 font-bold">摄影机机身</label>
                                                <select className="bg-[#13151a] border border-gray-700/50 rounded-lg px-2 py-1.5 text-xs text-gray-200 outline-none w-full cursor-pointer hover:border-blue-500" value={node.data.params.camera} onChange={e => updateNodeData(node.id, { params: { ...node.data.params, camera: e.target.value } })}>
                                                   {cameraBodies.map(o => <option key={o} value={o}>{o}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[10px] text-gray-500 font-bold">镜头群</label>
                                                <select className="bg-[#13151a] border border-gray-700/50 rounded-lg px-2 py-1.5 text-xs text-gray-200 outline-none w-full cursor-pointer hover:border-blue-500" value={node.data.params.lens} onChange={e => updateNodeData(node.id, { params: { ...node.data.params, lens: e.target.value } })}>
                                                   {lenses.map(o => <option key={o} value={o}>{o}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[10px] text-gray-500 font-bold">焦距</label>
                                                <select className="bg-[#13151a] border border-gray-700/50 rounded-lg px-2 py-1.5 text-xs text-gray-200 outline-none w-full cursor-pointer hover:border-blue-500" value={node.data.params.focal} onChange={e => updateNodeData(node.id, { params: { ...node.data.params, focal: e.target.value } })}>
                                                   {focals.map(o => <option key={o} value={o}>{o}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[10px] text-gray-500 font-bold">运镜/类别</label>
                                                <select className="bg-[#13151a] border border-gray-700/50 rounded-lg px-2 py-1.5 text-xs text-gray-200 outline-none w-full cursor-pointer hover:border-blue-500" value={node.data.params.lensType} onChange={e => updateNodeData(node.id, { params: { ...node.data.params, lensType: e.target.value } })}>
                                                   {lensTypes.map(o => <option key={o} value={o}>{o}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-2 pt-4 border-t border-gray-800">
                                            <button onClick={() => updateNodeData(node.id, { params: { ...node.data.params, camera: '自动', lens: '自动', focal: '自动', lensType: '标准镜头' } })} className="px-4 py-2 bg-[#1c1e26] hover:bg-[#3b3e46] text-gray-400 hover:text-white text-xs font-bold rounded-lg transition-colors border border-gray-700">清空</button>
                                            <button onClick={() => setActivePopover(null)} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-blue-900/20">保存</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        </>
                        )}
                    </div>
                    
                   <button className="flex items-center justify-center gap-1.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white px-5 py-2 rounded-full text-xs font-bold transition-colors shadow-lg active:scale-95 z-40" onClick={(e) => { e.stopPropagation(); setActivePopover(null); onRunNode(); }} onPointerDown={e => e.stopPropagation()}>
                     <ArrowUp className="w-4 h-4" /> 运行
                   </button>
                 </div>
               )}
           </div>
        )}
      </div>
      )}

        {(node.type === 'panorama720' || node.type === 'panorama360') && (
           <div className={`relative w-[480px] h-[320px] bg-[#0c1015] rounded-xl border ${isSelected ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'border-gray-800 hover:border-gray-700'} overflow-hidden shadow-2xl group/pano`} onPointerDown={e => e.stopPropagation()}>
             {/* Background Content */}
             {node.data.outputResult ? (
                <div className="absolute inset-0 w-full h-full" onPointerDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
                    {node.type === 'panorama720' ? (
                        <Plugin720Viewer id={node.id} imageUrl={node.data.outputResult} onCapture={(dataUrl) => {
                            addNode({ id: `shot-${Date.now()}`, type: 'imageBox', position: { x: node.position.x + (node.width || 480) + 50, y: node.position.y }, width: 320, data: { label: `查看器截图`, params: { prompt: '截图自全景', model: 'manual' }, outputResult: dataUrl, status: 'success' } });
                            toast.success('当前视角截图已保存至画布');
                        }}/>
                    ) : (
                        <Plugin360Viewer id={node.id} imageUrl={node.data.outputResult} onCapture={(dataUrl) => {
                            addNode({ id: `shot-${Date.now()}`, type: 'imageBox', position: { x: node.position.x + (node.width || 480) + 50, y: node.position.y }, width: 320, data: { label: `查看器截图`, params: { prompt: '截图自全景', model: 'manual' }, outputResult: dataUrl, status: 'success' } });
                            toast.success('当前视角截图已保存至画布');
                        }}/>
                    )}
                </div>
             ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                   <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                      <Wand2 className="w-6 h-6 text-gray-400" />
                   </div>
                   <div className="text-gray-400 text-sm font-medium">请先导入图片或生成长图全景</div>
                </div>
             )}

             {/* Top Left Tags */}
             <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10 pointer-events-none">
                <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-[11px] text-gray-200 border border-white/10 flex items-center shrink-0 w-fit">
                  {node.type === 'panorama720' ? '球形 720°' : '长图 360°'}
                </div>
                {node.data.outputResult && (
                  <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-[11px] text-gray-200 border border-white/10 flex items-center shrink-0 w-fit">
                    已生成
                  </div>
                )}
             </div>

             {/* Bottom Floating Menu Bar */}
             <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full z-20 transition-all opacity-0 group-hover/pano:opacity-100">
                {/* Gen / Run */}
                <button onClick={() => onRunNode()} className="w-9 h-9 rounded-full hover:bg-white/20 border border-white/10 flex items-center justify-center text-gray-200 transition-colors" title="运行生成">
                    <Wand2 className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-white/10" />
                {/* View Fullscreen */}
                <button onClick={() => {
                   if(node.data.outputResult) {
                       useWorkflowStore.getState().setFullScreenPanorama({ url: node.data.outputResult, type: node.type === 'panorama720' ? 'sphere' : 'cylinder', nodeId: node.id });
                   } else {
                       toast.error('请先生成或上传全景图');
                   }
                }} className={`w-9 h-9 rounded-full ${node.data.outputResult ? 'hover:bg-white/20 text-gray-200' : 'opacity-50 cursor-not-allowed text-gray-500'} border border-white/10 flex items-center justify-center transition-colors`} title="打开全景查看器">
                    <Maximize2 className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-white/10" />
                {/* Upload */}
                <label className="w-9 h-9 rounded-full hover:bg-white/20 border border-white/10 flex items-center justify-center text-gray-200 transition-colors cursor-pointer" title="上传全景">
                    <Upload className="w-4 h-4" />
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                            const reader = new FileReader();
                            reader.onload = (e) => updateNodeData(node.id, { outputResult: e.target?.result as string });
                            reader.readAsDataURL(e.target.files[0]);
                        }
                    }} />
                </label>
                <div className="w-px h-5 bg-white/10" />
                {/* Extract Views */}
                <button onClick={() => {
                   if (!node.data.outputResult) return toast.error('请先生成或上传全景图');
                   toast.promise(
                     extractPanoramaViews(node.data.outputResult, node.type === 'panorama720' ? 'sphere' : 'cylinder', node.type === 'panorama720' ? 6 : 4).then(res => {
                         res.forEach((r, i) => {
                             addNode({
                                 id: `view-${Date.now()}-${i}`, type: 'imageBox', position: { x: node.position.x + (node.width || 480) + 50, y: node.position.y + i * 160 }, width: 320,
                                 data: { label: `视图-${r.name}`, params: { prompt: `全景${r.name}视图`, model: 'manual' }, outputResult: r.url, status: 'success' }
                             });
                         });
                     }),
                     { loading: '正在提取多视图...', success: `已成功提取 ${node.type === 'panorama720' ? '6' : '4'} 视图节点!`, error: '提取失败' }
                   );
                }} className={`w-9 h-9 rounded-full ${node.data.outputResult ? 'hover:bg-white/20 text-gray-200' : 'opacity-50 cursor-not-allowed text-gray-500'} border border-white/10 flex items-center justify-center transition-colors`} title={node.type === 'panorama720' ? '提取6视图' : '提取4视图'}>
                    <ImageIcon className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-white/10" />
                {/* Original Details (mock) */}
                <button onClick={() => {
                   if (!node.data.outputResult) return toast.error('请先生成或上传全景图');
                   const a = document.createElement('a'); a.href = node.data.outputResult; a.download = `panorama_source_${node.id}.png`; a.click();
                }} className={`w-9 h-9 rounded-full ${node.data.outputResult ? 'hover:bg-white/20 text-gray-200' : 'opacity-50 cursor-not-allowed text-gray-500'} border border-white/10 flex items-center justify-center transition-colors`} title="下载原图">
                    {/* A fake "原图" icon with text, sticking closer to reference */}
                    <span className="text-[9px] font-bold">原图</span>
                </button>
             </div>
           </div>
        )}

        {node.type === 'imageBox' && node.data.outputResult && (node.data.outputResult.startsWith('data:image') || node.data.outputResult.startsWith('http')) && (
           <div className={`relative group/img bg-[#13151a] p-1.5 rounded-xl border ${isEditing ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'border-gray-800 hover:border-gray-700'} cursor-pointer transition-colors order-1`} onClick={() => setIsEditing(!isEditing)} onPointerDown={e => e.stopPropagation()}>
             <img src={node.data.outputResult} className="w-full rounded-lg pointer-events-none shadow-md" alt="Output" draggable={false} />
             <div className="absolute top-3 left-3 opacity-0 group-hover/img:opacity-100 transition-all bg-black/60 backdrop-blur-md rounded px-2 py-1 text-xs text-gray-200 border border-white/10 z-[60] pointer-events-none whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                 {node.data.mediaName || node.data.label || '未命名图片'}
             </div>
             <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover/img:opacity-100 transition-all bg-black/70 backdrop-blur-md rounded-lg p-1.5 border border-white/10 shadow-2xl z-[60]" onPointerDown={e => e.stopPropagation()}>
                <button onClick={() => setFullScreenImage(node.data.outputResult!)} className="p-1.5 hover:bg-white/20 rounded text-gray-200 transition-colors" title="放大浏览"><Maximize2 className="w-4 h-4" /></button>
                <div className="relative group/split popover-container" onPointerLeave={() => setActivePopover(null)}>
                  <button onPointerEnter={() => setActivePopover('camera')} className="p-1.5 hover:bg-white/20 rounded text-gray-200 transition-colors" title="切分网格"><LayoutGrid className="w-4 h-4" /></button>
                  {activePopover === 'camera' && (
                    <div className="absolute top-full right-0 mt-1 flex flex-col bg-zinc-800 rounded-lg overflow-hidden border border-gray-700 shadow-2xl text-nowrap pointer-events-auto">
                      <button onClick={(e) => { e.stopPropagation(); performImageSplit(node.data.outputResult!, 2, 2); setActivePopover(null); }} className="px-4 py-2.5 text-xs text-gray-200 hover:bg-gray-700 flex items-center gap-2 font-bold"><LayoutGrid className="w-3.5 h-3.5 text-purple-400" /> 2x2 切分</button>
                      <button onClick={(e) => { e.stopPropagation(); performImageSplit(node.data.outputResult!, 3, 3); setActivePopover(null); }} className="px-4 py-2.5 text-xs text-gray-200 hover:bg-gray-700 flex items-center gap-2 font-bold border-t border-gray-700"><LayoutGrid className="w-3.5 h-3.5 text-blue-400" /> 3x3 切分</button>
                    </div>
                  )}
                </div>
                <button onClick={() => { console.log('剪辑编辑器开发中...'); }} className="p-1.5 hover:bg-white/20 rounded text-gray-200 transition-colors" title="剪辑图片"><Crop className="w-4 h-4" /></button>
                <button onClick={() => { const a = document.createElement('a'); a.href = node.data.outputResult!; a.download = `${node.data.mediaName || 'export'}.png`; a.click(); }} className="p-1.5 hover:bg-white/20 rounded text-gray-200 transition-colors" title="下载到本地"><Download className="w-4 h-4" /></button>
                <button onClick={() => { console.log('已加入左侧资产库!'); }} className="p-1.5 hover:bg-white/20 rounded text-gray-200 transition-colors" title="保存到资产库"><Library className="w-4 h-4" /></button>
             </div>
           </div>
        )}

        {node.type === 'videoBox' && node.data.outputResult && (node.data.outputResult.startsWith('data:video') || node.data.outputResult.startsWith('http') || node.data.outputResult.startsWith('blob:')) && (
           <div className={`relative group/vid bg-[#13151a] p-1.5 rounded-xl border ${isEditing ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'border-gray-800 hover:border-gray-700'} cursor-pointer transition-colors order-1`} onClick={() => setIsEditing(!isEditing)} onPointerDown={e => e.stopPropagation()}>
             <video src={node.data.outputResult} className="w-full rounded-lg pointer-events-none shadow-md" autoPlay loop muted playsInline />
             <div className="absolute top-3 left-3 opacity-0 group-hover/vid:opacity-100 transition-all bg-black/60 backdrop-blur-md rounded px-2 py-1 text-xs text-gray-200 border border-white/10 z-[60] pointer-events-none whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                 {node.data.mediaName || node.data.label || '未命名视频'}
             </div>
             <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover/vid:opacity-100 transition-all bg-black/70 backdrop-blur-md rounded-lg p-1.5 border border-white/10 shadow-2xl z-[60]" onPointerDown={e => e.stopPropagation()}>
                <button onClick={() => { const a = document.createElement('a'); a.href = node.data.outputResult!; a.download = `${node.data.mediaName || 'export'}.mp4`; a.click(); }} className="p-1.5 hover:bg-white/20 rounded text-gray-200 transition-colors" title="下载到本地"><Download className="w-4 h-4" /></button>
                <button onClick={() => { console.log('已加入左侧资产库!'); }} className="p-1.5 hover:bg-white/20 rounded text-gray-200 transition-colors" title="保存到资产库"><Library className="w-4 h-4" /></button>
             </div>
           </div>
        )}

        {node.type === 'audioBox' && node.data.outputResult && (node.data.outputResult.startsWith('data:audio') || node.data.outputResult.startsWith('http') || node.data.outputResult.startsWith('blob:')) && (
           <div className={`relative group/audio bg-[#13151a] p-3 rounded-xl border ${isEditing ? 'border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.2)]' : 'border-gray-800 hover:border-gray-700'} cursor-pointer transition-colors order-1`} onClick={() => setIsEditing(!isEditing)} onPointerDown={e => e.stopPropagation()}>
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                   <Music className="w-5 h-5 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                   <div className="text-xs font-bold text-gray-200 truncate">{node.data.mediaName || node.data.label || '未命名音频'}</div>
                   <audio src={node.data.outputResult} controls className="w-full h-8 mt-1" onPointerDown={e => e.stopPropagation()} />
                </div>
             </div>
             <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover/audio:opacity-100 transition-all bg-black/70 backdrop-blur-md rounded-lg p-1.5 border border-white/10 shadow-2xl z-[60]" onPointerDown={e => e.stopPropagation()}>
                <button onClick={() => { const a = document.createElement('a'); a.href = node.data.outputResult!; a.download = `${node.data.mediaName || 'export'}.mp3`; a.click(); }} className="p-1.5 hover:bg-white/20 rounded text-gray-200 transition-colors" title="下载到本地"><Download className="w-4 h-4" /></button>
             </div>
           </div>
        )}

        {node.type === 'videoSynth' && (
           <div className="flex flex-col gap-0 pointer-events-auto" onPointerDown={e => e.stopPropagation()}>
               <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 pointer-events-none">
                  <div className="text-gray-200 text-sm font-bold tracking-wide">视频编排</div>
                  <div className="px-2 py-0.5 rounded border border-blue-500/30 text-blue-400 text-[10px] font-bold">输出</div>
               </div>
               
               <div className="p-4 flex flex-col gap-4">
                   <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-xs tracking-wider">
                         {(node.data.params.clips || []).length} 个片段 - {(node.data.params.clips || []).reduce((acc: number, c: any) => acc + (c.duration || 0), 0).toFixed(1)}s
                      </span>
                      <button className="text-purple-400 hover:text-purple-300 text-xs font-bold transition-colors cursor-pointer" onClick={() => {
                          const upstreamNodesId = new Set<string>();
                          edges.forEach(e => { if (e.target === node.id) upstreamNodesId.add(e.source); });
                          const mediaNodes = nodes.filter(n => upstreamNodesId.has(n.id) && (n.type === 'videoBox' || n.type === 'imageBox' || n.type === 'panorama720' || n.type === 'panorama360') && n.data.outputResult);
                          if (mediaNodes.length === 0) {
                              toast.info('未找到可用的上游多媒体节点');
                              updateNodeData(node.id, { params: { ...node.data.params, clips: [] } });
                              return;
                          }
                          const clips = mediaNodes.map((m, i) => ({ id: m.id + '-' + i, name: '片段 ' + (i+1), start: 0, end: 5, duration: 5, url: m.data.outputResult, type: m.type === 'videoBox' ? 'video' : 'image' }));
                          updateNodeData(node.id, { params: { ...node.data.params, clips } });
                          toast.success(`成功导入 ${clips.length} 个片段`);
                      }}>
                          获取上游视频
                      </button>
                   </div>

                   {(!node.data.params.clips || node.data.params.clips.length === 0) ? (
                       <div className="py-6 flex justify-center items-center text-gray-600 text-xs">
                          连接上游视频节点后点击「获取上游视频」
                       </div>
                   ) : (
                       <div className="flex flex-col gap-2">
                           {node.data.params.clips.map((clip: any, i: number) => (
                               <div key={clip.id} className="flex flex-col gap-2 bg-[#1c1e26] border border-gray-800 rounded-lg p-2 px-3">
                                   <div className="flex justify-between items-center">
                                       <div className="flex items-center gap-2 text-gray-300 text-xs">
                                           <GripVertical className="w-3.5 h-3.5 text-gray-600 cursor-grab" />
                                           <span className="text-gray-600 select-none mr-1">{i+1}</span>
                                           <span>{clip.name}</span>
                                       </div>
                                       <div className="flex items-center gap-1.5">
                                           <button className="text-gray-600 hover:text-white transition-colors disabled:opacity-30 disabled:hover:text-gray-600" disabled={i === 0} onClick={() => {
                                               const newClips = [...node.data.params.clips];
                                               [newClips[i], newClips[i-1]] = [newClips[i-1], newClips[i]];
                                               updateNodeData(node.id, { params: { ...node.data.params, clips: newClips } });
                                           }}>
                                               <ArrowUp className="w-3.5 h-3.5" />
                                           </button>
                                           <button className="text-gray-600 hover:text-white transition-colors disabled:opacity-30 disabled:hover:text-gray-600" disabled={i === node.data.params.clips.length - 1} onClick={() => {
                                               const newClips = [...node.data.params.clips];
                                               [newClips[i], newClips[i+1]] = [newClips[i+1], newClips[i]];
                                               updateNodeData(node.id, { params: { ...node.data.params, clips: newClips } });
                                           }}>
                                               <ChevronDown className="w-3.5 h-3.5" />
                                           </button>
                                           <button className="text-gray-600 hover:text-red-400 transition-colors ml-1" onClick={() => {
                                               const newClips = node.data.params.clips.filter((c: any) => c.id !== clip.id);
                                               updateNodeData(node.id, { params: { ...node.data.params, clips: newClips } });
                                           }}>
                                               <Trash2 className="w-3.5 h-3.5" />
                                           </button>
                                       </div>
                                   </div>
                                   <div className="flex items-center gap-2 pl-9">
                                       <Scissors className="w-3.5 h-3.5 text-gray-600" />
                                       <div className="flex items-center gap-1">
                                          <input className="w-10 bg-[#13151a] border border-gray-800 rounded px-1.5 py-1 text-xs text-gray-200 outline-none text-center" value={clip.start} onChange={(e) => {
                                              const newClips = [...node.data.params.clips];
                                              newClips[i].start = Number(e.target.value);
                                              newClips[i].duration = newClips[i].end - newClips[i].start;
                                              updateNodeData(node.id, { params: { ...node.data.params, clips: newClips } });
                                          }}/>
                                          <span className="text-gray-500">—</span>
                                          <input className="w-10 bg-[#13151a] border border-gray-800 rounded px-1.5 py-1 text-xs text-gray-200 outline-none text-center" value={clip.end} onChange={(e) => {
                                              const newClips = [...node.data.params.clips];
                                              newClips[i].end = Number(e.target.value);
                                              newClips[i].duration = newClips[i].end - newClips[i].start;
                                              updateNodeData(node.id, { params: { ...node.data.params, clips: newClips } });
                                          }}/>
                                          <span className="text-gray-500 text-xs ml-1">s</span>
                                       </div>
                                   </div>
                               </div>
                           ))}
                       </div>
                   )}
                   
                   <div className="flex items-center gap-2">
                       <div className="relative flex-1">
                           <select className="w-full bg-[#1c1e26] border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300 outline-none appearance-none cursor-pointer" value={node.data.params.transitionType || 'none'} onChange={e => updateNodeData(node.id, { params: { ...node.data.params, transitionType: e.target.value } })}>
                               <option value="none">无转场</option>
                               <option value="fade_black">黑场淡出</option>
                               <option value="fade_white">白场闪耀</option>
                               <option value="zoom_in">推镜淡入</option>
                               <option value="zoom_out">拉回淡入</option>
                               <option value="slide_left">向左侧滑</option>
                               <option value="slide_right">向右侧滑</option>
                               <option value="slide_up">向上侧滑</option>
                               <option value="slide_down">向下侧滑</option>
                               <option value="wipe_right">擦除(右)</option>
                               <option value="blur">模糊渐入</option>
                           </select>
                           <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                       </div>
                       {(!node.data.params.transitionType || node.data.params.transitionType !== 'none') && (
                           <div className="flex items-center gap-1 border border-gray-800 rounded-lg bg-[#1c1e26] px-2 py-1">
                               <input className="bg-transparent w-10 text-xs text-gray-200 outline-none text-center" value={node.data.params.transitionDuration || '0.5'} onChange={e => updateNodeData(node.id, { params: { ...node.data.params, transitionDuration: e.target.value } })} />
                               <span className="text-gray-500 text-xs">s</span>
                           </div>
                       )}
                   </div>

                   {node.data.outputResult && (
                       <div className="relative rounded-lg overflow-hidden border border-gray-800 bg-[#0c1015]">
                          {node.data.outputResult.startsWith('data:image') || node.data.outputResult.startsWith('http') && !node.data.outputResult.endsWith('.mp4') ? (
                              <img src={node.data.outputResult} className="w-full h-auto" draggable={false} />
                          ) : (
                              <video src={node.data.outputResult} className="w-full h-auto" controls autoPlay loop />
                          )}
                       </div>
                   )}

                   <button className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#2a134a] hover:bg-[#3d1c6e] border border-[#4a2485] text-[#d6b4fc] text-xs font-bold transition-colors" onClick={async () => {
                        const clips = node.data.params.clips || [];
                        if (clips.length === 0) return toast.error('请先获取上游视频');
                        updateNodeData(node.id, { status: 'running' });
                        try {
                            const resultBlob = await synthesizeVideo(clips, {
                                transitionType: node.data.params.transitionType,
                                transitionDuration: Number(node.data.params.transitionDuration) || 0.5
                            });
                            updateNodeData(node.id, { status: 'success', outputResult: resultBlob });
                            toast.success('视频合成完毕！');
                        } catch (err: any) {
                            console.error(err);
                            toast.error('视频合成失败: ' + err.message);
                            updateNodeData(node.id, { status: 'error' });
                        }
                   }}>
                       <Film className="w-3.5 h-3.5" /> 合成视频
                   </button>
               </div>
           </div>
        )}

      {node.data.status === 'running' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl border border-purple-500/50">
             <div className="flex flex-col items-center gap-3">
               <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
               <div className="text-xs font-bold animate-pulse text-purple-300 tracking-widest">{node.type === 'videoSynth' ? 'SYNTHESIZING (REAL-TIME)' : 'EXECUTING'}</div>
             </div>
          </div>
      )}
    </div>
  );
}

// ========== Model Selector Subcomponent ==========
const defaultImageModels = [
  { id: 'nano-banana-2', name: 'Nano Banana 2' },
  { id: 'flux-schnell', name: 'Flux Schnell' },
  { id: 'sdxl', name: 'SDXL 1.0' },
  { id: 'gpt-image-1', name: 'GPT Image 1' },
  { id: 'dall-e-3', name: 'DALL-E 3' },
];

const defaultVideoModels = [
  { id: 'luma', name: 'Luma Dream Machine' },
  { id: 'runway', name: 'Runway Gen-3' },
  { id: 'sora', name: 'OpenAI Sora' },
  { id: 'kling', name: '可灵 Kling' },
];

const defaultAudioModels = [
  { id: 'minimax-speech', name: 'MiniMax 语音合成' },
  { id: 'minimax-music', name: 'MiniMax 音乐生成' },
  { id: 'suno', name: 'Suno AI 音乐' },
  { id: 'elevenlabs', name: 'ElevenLabs TTS' },
  { id: 'fish-speech', name: 'Fish Speech' },
];

function ModelSelector({ node }: { node: AppNode }) {
  const { updateNodeData } = useWorkflowStore();
  const { getImageModels, getVideoModels, getAudioModels } = useSettingsStore();

  const isImage = node.type === 'imageBox' || node.type === 'panorama720' || node.type === 'panorama360';
  const isAudio = node.type === 'audioBox';
  let storeModels: { id: string; name: string }[] = [];
  if (isImage) storeModels = getImageModels();
  else if (isAudio) storeModels = getAudioModels();
  else storeModels = getVideoModels();

  const defaultModels = isImage ? defaultImageModels : isAudio ? defaultAudioModels : defaultVideoModels;
  const models = storeModels.length > 0 ? storeModels : defaultModels;

  return (
    <select
      className="bg-transparent text-xs font-bold text-gray-200 outline-none cursor-pointer appearance-none pr-2 max-w-[140px] truncate"
      value={node.data.params.model || ''}
      onChange={(e) => updateNodeData(node.id, { params: { ...node.data.params, model: e.target.value } })}
      onPointerDown={e => e.stopPropagation()}
    >
      {models.map((model) => (
        <option key={model.id} value={model.id} className="bg-[#22242a]">
          {model.name}
        </option>
      ))}
    </select>
  );
}
