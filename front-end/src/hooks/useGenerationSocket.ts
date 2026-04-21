import React, { useEffect, useCallback, useRef } from 'react';
import { useProjectStore } from '../stores/useProjectStore';
import { useWorkflowStore } from '../stores/useCanvasStore';
import { toast } from 'sonner';
import { normalizeEntities, normalizeStoryboard } from '../lib/scriptUtils';

export const useGenerationSocket = () => {
  const updateAssetState = useProjectStore(s => s.updateAssetState);
  const updateScene = useProjectStore(s => s.updateScene);
  const setAssets = useProjectStore(s => s.setAssets);
  const setScenes = useProjectStore(s => s.setScenes);
  const setGlobalLoading = useProjectStore(s => s.setGlobalLoading);
  const currentProjectId = useProjectStore(s => s.currentProjectId);
  const createProject = useProjectStore(s => s.createProject);
  
  const [isConnected, setIsConnected] = React.useState(false);
  const [reconnectCount, setReconnectCount] = React.useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const apiKey = import.meta.env.VITE_API_KEY || '';
    
    if (!baseUrl) return;

    const wsUrl = baseUrl
      .replace(/^http/, 'ws')
      .replace(/\/+$/, '') + '/ws';
    
    console.log(`正在尝试连接内核脉冲... (第 ${reconnectCount} 次尝试)`);
    const socket = new WebSocket(`${wsUrl}?token=${apiKey}`);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
      setReconnectCount(0); // 重置重连次数
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };

    socket.onmessage = (event) => {
      try {
        const { event: type, payload } = JSON.parse(event.data);
        
        switch (type) {
          case 'TASK_HEARTBEAT':
            console.log("收到任务心跳:", payload);
            break;
          case 'SCRIPT_PARSED':
            {
              let data = payload.data;
              let pid = useProjectStore.getState().currentProjectId;

              if (payload.projectId === 'NEW_DRAFT' || pid === 'NEW_DRAFT' || !pid) {
                const projectName = payload.suggestedTitle || "剧本序列_" + new Date().toLocaleTimeString('zh-CN', { hour12: false });
                pid = createProject(projectName);
              }
              
              const characters = normalizeEntities(data.characters, 'character');
              const scenes = normalizeEntities(data.scenes, 'scene');
              const props = normalizeEntities(data.props, 'prop');
              
              // We use pid directly to ensure we are targeting the right one if we just created it
              setAssets({ characters, scenes, props }, pid || undefined);
              setScenes(normalizeStoryboard(data.storyboard, { characters, scenes, props }), pid || undefined);
              
              setGlobalLoading(false);
              toast.success("剧本异步解析完成，全案数据已同步");
            }
            break;
          case 'ACK':
            console.log("任务已由后端接收:", payload);
            break;
          case 'PROGRESS_UPDATE':
            updateAssetState(payload.entityId || '', payload.targetId, { 
              status: payload.status, 
              progress: payload.progress 
            });
            break;
          case 'TASK_COMPLETED':
            {
              const { targetId, entityId, resultUrl } = payload;
              updateAssetState(entityId || '', targetId, { 
                status: 'completed', 
                progress: 100, 
                imageUrl: resultUrl 
              });

              // Sync to Canvas
              const canvasNodeId = `asset-${entityId}-${targetId}`;
              if (useWorkflowStore.getState().nodes.some(n => n.id === canvasNodeId)) {
                useWorkflowStore.getState().updateNodeData(canvasNodeId, {
                  status: 'success',
                  outputResult: resultUrl
                });
              }

              toast.success(`资产生成完成: ${targetId}`);
            }
            break;
          case 'SCENE_COMPLETED':
            {
              const { targetId, resultUrl } = payload;
              updateScene(targetId, {
                status: 'completed',
                resultUrl: resultUrl
              });

              // Sync to Canvas
              const canvasNodeId = `sb-${targetId}`;
              if (useWorkflowStore.getState().nodes.some(n => n.id === canvasNodeId)) {
                useWorkflowStore.getState().updateNodeData(canvasNodeId, {
                  status: 'success',
                  outputResult: resultUrl
                });
              }

              toast.success(`分镜渲染完成: ${targetId}`);
            }
            break;
          case 'ERROR':
            setGlobalLoading(false);
            toast.error(payload.message || "生成同步异常");
            break;
        }
      } catch (err) {
        console.error("WebSocket message parse error:", err);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket Error:", error);
      setIsConnected(false);
      setGlobalLoading(false);
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
      setIsConnected(false);
      setGlobalLoading(false);
      
      // 指数退避重连逻辑
      const delay = Math.min(30000, Math.pow(2, reconnectCount) * 1000);
      reconnectTimerRef.current = setTimeout(() => {
        setReconnectCount(prev => prev + 1);
      }, delay);
    };

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [updateAssetState, updateScene, setAssets, setScenes, setGlobalLoading, createProject, reconnectCount]);

  const startAssetGen = useCallback((entityId: string, stateId: string, payload: any) => {
    // ... 原逻辑不变 ...
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      toast.error("WebSocket 未连接，无法启动生成");
      return;
    }

    socketRef.current.send(JSON.stringify({
      action: 'START_ASSET_GEN',
      payload: { ...payload, entityId, stateId }
    }));
  }, []);

  const startSceneGen = useCallback((sceneId: string, payload: any) => {
    // ... 原逻辑不变 ...
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      toast.error("WebSocket 未连接，无法启动渲染");
      return;
    }

    socketRef.current.send(JSON.stringify({
      action: 'START_SCENE_GEN',
      payload: { ...payload, sceneId }
    }));
  }, []);

  const parseScript = useCallback((scriptContent: string, projectId: string | null) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      toast.error("WebSocket 未连接，无法发起解析请求");
      return;
    }

    setGlobalLoading(true, "深层语言模型正在解析剧本结构...");
    
    try {
      socketRef.current.send(JSON.stringify({
        action: 'PARSE_SCRIPT',
        payload: { scriptContent, projectId }
      }));
      // ... 原逻辑不变 ...
    } catch (err) {
      setGlobalLoading(false);
      toast.error("请求发送失败，请重试");
    }
  }, [setGlobalLoading]);

  return { startAssetGen, startSceneGen, parseScript, isConnected };
};
