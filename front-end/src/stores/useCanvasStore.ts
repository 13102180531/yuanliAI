import { create } from 'zustand';

export type NodeStatus = 'idle' | 'running' | 'success' | 'error';
export type NodeType = 'textInput' | 'imageBox' | 'videoBox' | 'audioBox' | 'videoSynth' | 'scriptBox' | 'panorama720' | 'panorama360' | 'blank';

export interface WorkflowNodeData {
  label: string;
  params: Record<string, any>;
  outputResult?: string; 
  status: NodeStatus;
  errorMsg?: string;
  mediaName?: string; 
}

export interface AppNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  width?: number;
  data: WorkflowNodeData;
  groupId?: string; 
}

export interface AppEdge {
  id: string;
  source: string;
  target: string;
}

export interface AppGroup {
  id: string;
  nodeIds: string[];
}

interface WorkflowState {
  nodes: AppNode[];
  edges: AppEdge[];
  groups: AppGroup[];
  past: any[]; 
  future: any[]; 
  isRunning: boolean;
  selectedNodeIds: string[]; 
  clipboard: AppNode[];
  activeTool: 'arrow' | 'hand'; 
  fullScreenImage: string | null; 
  fullScreenPanorama: { url: string, type: 'sphere' | 'cylinder', nodeId: string } | null;
  
  setTool: (tool: 'arrow' | 'hand') => void;
  addNode: (node: AppNode) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  moveGroup: (groupId: string, dx: number, dy: number) => void;
  updateNodeData: (id: string, newData: Partial<WorkflowNodeData>) => void;
  updateNodeType: (id: string, newType: NodeType) => void; 
  deleteNode: (id: string) => void;
  addEdge: (edge: AppEdge) => void;
  deleteEdge: (id: string) => void;
  setIsRunning: (isRunning: boolean) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  setFullScreenImage: (url: string | null) => void; 
  setFullScreenPanorama: (data: { url: string, type: 'sphere' | 'cylinder', nodeId: string } | null) => void;
  resetRunState: () => void;
  clearCanvas: () => void;
  saveSnapshot: () => void; 
  undo: () => void; 
  redo: () => void;
  createGroup: (nodeIds: string[]) => void;
  ungroup: (groupId: string) => void;
  copyNodes: (nodeIds: string[]) => void;
  pasteNodes: (x: number, y: number) => void;
  duplicateNodes: (nodeIds: string[]) => void;
  setNodes: (nodes: AppNode[]) => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: [], edges: [], groups: [], past: [], future: [], isRunning: false,
  selectedNodeIds: [], clipboard: [], activeTool: 'arrow', fullScreenImage: null, fullScreenPanorama: null,
  
  setTool: (activeTool) => set({ activeTool, selectedNodeIds: [] }),
  saveSnapshot: () => {
    const { nodes, edges, groups, past } = get();
    try {
        set({ past: [...past, { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)), groups: JSON.parse(JSON.stringify(groups)) }].slice(-50), future: [] });
    } catch(e) {
        set({ past: [...past, { nodes: structuredClone(nodes), edges: structuredClone(edges), groups: structuredClone(groups) }].slice(-50), future: [] });
    }
  },
  undo: () => {
    const { past, future, nodes, edges, groups } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    set({ past: past.slice(0, -1), future: [{ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)), groups: JSON.parse(JSON.stringify(groups)) }, ...future], nodes: prev.nodes, edges: prev.edges, groups: prev.groups, selectedNodeIds: [] });
  },
  redo: () => {
    const { past, future, nodes, edges, groups } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({ past: [...past, { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)), groups: JSON.parse(JSON.stringify(groups)) }], future: future.slice(1), nodes: next.nodes, edges: next.edges, groups: next.groups, selectedNodeIds: [] });
  },
  addNode: (node) => set({ nodes: [...get().nodes, node] }),
  updateNodePosition: (id, position) => set(s => ({ nodes: s.nodes.map(n => n.id === id ? { ...n, position } : n) })),
  moveGroup: (groupId, dx, dy) => set({ nodes: get().nodes.map(n => n.groupId === groupId ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n) }),
  updateNodeData: (id, newData) => set({ nodes: get().nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...newData } } : n) }),
  updateNodeType: (id, newType) => set({ nodes: get().nodes.map(n => n.id === id ? { ...n, type: newType, data: { ...n.data, label: newType === 'imageBox' ? '图片' : n.data.label } } : n) }),
  deleteNode: (id) => set({ nodes: get().nodes.filter(n => n.id !== id), edges: get().edges.filter(e => e.source !== id && e.target !== id), selectedNodeIds: get().selectedNodeIds.filter(sid => sid !== id) }),
  addEdge: (edge) => set({ edges: [...get().edges, edge] }),
  deleteEdge: (id) => set({ edges: get().edges.filter(e => e.id !== id) }),
  setIsRunning: (isRunning) => set({ isRunning }),
  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
  setFullScreenImage: (url) => set({ fullScreenImage: url }),
  setFullScreenPanorama: (data) => set({ fullScreenPanorama: data }),
  resetRunState: () => set({ nodes: get().nodes.map(n => ({ ...n, data: { ...n.data, status: 'idle', errorMsg: undefined } })) }),
  clearCanvas: () => set({ nodes: [], edges: [], groups: [], selectedNodeIds: [], isRunning: false }),
  createGroup: (nodeIds) => {
    const id = `group-${Date.now()}`;
    set({ groups: [...get().groups, { id, nodeIds }], nodes: get().nodes.map(n => nodeIds.includes(n.id) ? { ...n, groupId: id } : n), selectedNodeIds: nodeIds });
  },
  ungroup: (groupId) => set({ groups: get().groups.filter(g => g.id !== groupId), nodes: get().nodes.map(n => n.groupId === groupId ? { ...n, groupId: undefined } : n) }),
  copyNodes: (nodeIds) => {
    const { nodes } = get();
    set({ clipboard: nodes.filter(n => nodeIds.includes(n.id)).map(n => structuredClone(n)) });
  },
  pasteNodes: (x, y) => {
    const { clipboard, nodes } = get();
    if (clipboard.length === 0) return;
    const clones: AppNode[] = clipboard.map((o, i) => ({ ...structuredClone(o), id: `${o.id}-paste-${Date.now()}-${i}`, position: { x: x + i * 50, y: y + i * 50 }, groupId: undefined }));
    set({ nodes: [...nodes, ...clones], selectedNodeIds: clones.map(c => c.id) });
  },
  duplicateNodes: (nodeIds) => {
    const { nodes, edges } = get();
    const map: Record<string, string> = {};
    const clones: AppNode[] = [];
    nodeIds.forEach(id => {
      const o = nodes.find(n => n.id === id);
      if (o) {
        const nid = `${o.id}-cln-${Date.now()}`;
        map[id] = nid;
        clones.push({ ...structuredClone(o), id: nid, position: { x: o.position.x + 50, y: o.position.y + 50 }, groupId: undefined });
      }
    });
    const newEdges: AppEdge[] = [];
    edges.forEach(e => { if (map[e.source] && map[e.target]) newEdges.push({ id: `edg-cln-${Date.now()}-${Math.random()}`, source: map[e.source], target: map[e.target] }); });
    set({ nodes: [...nodes, ...clones], edges: [...edges, ...newEdges], selectedNodeIds: clones.map(c => c.id) });
  },
  setNodes: (nodes) => set({ nodes })
}));
