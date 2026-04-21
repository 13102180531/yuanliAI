import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { ScriptImporter } from './components/script/ScriptImporter';
import { AssetManager } from './components/assets/AssetManager';
import { StoryboardView } from './components/storyboard/StoryboardView';
import { InfiniteCanvasView } from './components/canvas/InfiniteCanvasView';
import { HomeView } from './components/home/HomeView';
import { ThemeSelector } from './components/layout/ThemeSelector';
import { useProjectStore } from './stores/useProjectStore';
import { Toaster } from '@/components/ui/sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, X, Globe, Camera as CameraIcon, LogIn, User, Settings } from 'lucide-react';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { toast } from 'sonner';

import { GlobalLoadingOverlay } from './components/layout/GlobalLoadingOverlay';

import { Plugin720Viewer, Plugin360Viewer } from './components/canvas/PanoramaPlugins';
import { useWorkflowStore } from './stores/useCanvasStore';
import { AuthModal } from './components/auth/AuthModal';

export default function App() {
  const [activeTab, setActiveTab] = React.useState<'script' | 'assets' | 'storyboard' | 'canvas'>('script');
  const [theme, setTheme] = useState('dark');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('xueding_token');
    if (token) {
      setIsLoggedIn(true);
    } else {
      // Show auth modal if not logged in
      setShowAuthModal(true);
    }
  }, []);
  const currentProjectId = useProjectStore(s => s.currentProjectId);
  const setCurrentProject = useProjectStore(s => s.setCurrentProject);
  const currentProject = useProjectStore(s => currentProjectId ? s.projects[currentProjectId] : null);
  const fullScreenPanorama = useWorkflowStore(s => s.fullScreenPanorama);
  const setFullScreenPanorama = useWorkflowStore(s => s.setFullScreenPanorama);

  const themeColors: Record<string, { bg: string, card: string, foreground: string, primary: string }> = {
    night: { bg: '#0a0a0c', card: '#151518', foreground: '#e0e0e0', primary: '#00f0ff' },
    pink: { bg: '#1a0f18', card: '#2d1b2a', foreground: '#e0e0e0', primary: '#ff85c0' },
    dark: { bg: '#1a2b3c', card: '#253f58', foreground: '#e0e0e0', primary: '#ADD8E6' },
    light: { bg: '#f5f5f5', card: '#ffffff', foreground: '#1a1a1a', primary: '#007bff' },
  };

  const renderContent = () => {
    // Require login for all content
    if (!isLoggedIn) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">请先登录以使用系统功能</p>
            <Button onClick={() => setShowAuthModal(true)} className="bg-blue-600 hover:bg-blue-500">
              <LogIn className="w-4 h-4 mr-2" />
              登录 / 注册
            </Button>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'script':
        return <ScriptImporter key="script" />;
      case 'assets':
        return <AssetManager key="assets" />;
      case 'storyboard':
        return <StoryboardView key="storyboard" />;
      case 'canvas':
        return <InfiniteCanvasView key="canvas" />;
      default:
        return <ScriptImporter key="script" />;
    }
  };

  return (
    <div 
      className="flex flex-col h-screen overflow-hidden font-sans" 
      style={{ 
        backgroundColor: themeColors[theme].bg,
        color: themeColors[theme].foreground,
        '--background': themeColors[theme].bg,
        '--card-bg': themeColors[theme].card,
        '--color-primary': themeColors[theme].primary,
      } as React.CSSProperties}
    >
      {/* Design Header */}
      <header className="h-[60px] border-b border-secondary flex items-center justify-between px-6 shrink-0 z-50" style={{ backgroundColor: 'var(--card-bg)' }}>
        <div className="flex items-center gap-6">
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-gray-800/50 rounded-lg transition-colors text-gray-400 hover:text-gray-200"
            title="设置"
          >
            <Settings className="w-4 h-4" />
          </button>
          <div className="text-sm font-black tracking-[0.2em] uppercase flex items-center gap-3">
            愿力AI 剧本可视化引擎
            <span className="text-[10px] text-primary border border-primary px-1.5 py-0.5 leading-none hidden sm:inline-block">V1.0.4-专业版</span>
          </div>
          {currentProjectId && (
            <div className="flex items-center gap-4 border-l border-secondary pl-6">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setCurrentProject(null)}
                className="h-8 text-xs font-mono text-muted-foreground hover:text-primary rounded-none transition-colors"
                title="返回所有创作"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> 返回首页
              </Button>
              <div className="text-[11px] font-mono font-bold text-primary uppercase tracking-wider">
                当前: {currentProjectId === 'NEW_DRAFT' ? '新建草稿序列' : currentProject?.name}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-4 items-center">
          <ThemeSelector onThemeChange={setTheme} currentTheme={theme} />
          <div className="border-l border-secondary pl-4">
             {isLoggedIn ? (
                 <Button 
                     variant="outline" 
                     size="sm" 
                     onClick={() => {
                        localStorage.removeItem('xueding_token');
                        setIsLoggedIn(false);
                        toast.success('已退出登录');
                     }}
                     className="h-8 text-xs font-mono border-gray-600 text-gray-300 hover:text-white"
                 >
                     <User className="w-4 h-4 mr-2" />
                     退出登录
                 </Button>
             ) : (
                 <Button 
                     onClick={() => setShowAuthModal(true)}
                     size="sm" 
                     className="h-8 text-xs font-mono bg-blue-600 hover:bg-blue-500 text-white"
                 >
                     <LogIn className="w-4 h-4 mr-2" />
                     登录 / 注册
                 </Button>
             )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {!currentProjectId ? (
          <main className="flex-1 relative overflow-auto bg-transparent">
            <AnimatePresence mode="wait">
              <motion.div
                key="home"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {isLoggedIn ? (
                  <HomeView />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <h2 className="text-2xl font-bold mb-4">欢迎使用愿力AI</h2>
                      <p className="text-muted-foreground mb-6">请先登录以开始创作</p>
                      <Button onClick={() => setShowAuthModal(true)} className="bg-blue-600 hover:bg-blue-500">
                        <LogIn className="w-4 h-4 mr-2" />
                        登录 / 注册
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        ) : (
          <>
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            <main className="flex-1 relative overflow-hidden bg-transparent">
              <div className="h-full w-full max-w-[1600px] mx-auto px-6 py-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="h-full flex flex-col"
                  >
                    {renderContent()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </main>
          </>
        )}
      </div>

      {/* Design Footer */}
      <footer className="h-[40px] bg-background border-t border-secondary flex items-center justify-between px-6 font-mono text-[10px] text-muted-foreground shrink-0 z-50">
        <div>日志: [{new Date().toLocaleTimeString([], { hour12: false })}] 引擎状态 — 正常</div>
        <div className="text-primary/80 animate-pulse uppercase tracking-wider hidden md:block">
          {`>>> 系统引擎运行状态良好 | 未检测到异常 | 持久化存储已工作 <<<`}
        </div>
        <div>会话令牌: {currentProjectId === 'NEW_DRAFT' ? 'DRAFT_MODE' : (currentProjectId ? currentProjectId.split('_')[2] : 'IDLE')}</div>
      </footer>
      
      {fullScreenPanorama && (
        <div className="fixed inset-0 z-[99999] bg-black/95 flex flex-col p-8 backdrop-blur-sm" tabIndex={-1}>
            <button onClick={() => setFullScreenPanorama(null)} className="absolute top-6 right-6 text-white hover:text-red-400 z-50 bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors backdrop-blur-md">
                <X className="w-6 h-6" />
            </button>
            <div className="text-white font-bold opacity-50 mb-2 flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                全景查看模式
            </div>
            <div className="flex-1 rounded-2xl overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10">
                {fullScreenPanorama.type === 'sphere' ? (
                    <Plugin720Viewer id={fullScreenPanorama.nodeId} imageUrl={fullScreenPanorama.url} onCapture={(dataUrl) => {
                        useWorkflowStore.getState().addNode({
                            id: `shot-${Date.now()}`, type: 'imageBox', position: { x: 100, y: 100 }, width: 320,
                            data: { label: `查看器截图`, params: { prompt: '截图自全景查看器', model: 'manual' }, outputResult: dataUrl, status: 'success' }
                        });
                        toast.success('全景内的截图已保存至画布');
                    }} />
                ) : (
                    <Plugin360Viewer id={fullScreenPanorama.nodeId} imageUrl={fullScreenPanorama.url} onCapture={(dataUrl) => {
                        useWorkflowStore.getState().addNode({
                            id: `shot-${Date.now()}`, type: 'imageBox', position: { x: 100, y: 100 }, width: 320,
                            data: { label: `查看器截图`, params: { prompt: '截图自全景查看器', model: 'manual' }, outputResult: dataUrl, status: 'success' }
                        });
                        toast.success('全景内的截图已保存至画布');
                    }} />
                )}
            </div>
            <div className="flex justify-center mt-6">
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('capture-panorama', { detail: { nodeId: fullScreenPanorama.nodeId } }))} 
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all text-sm"
                >
                  <CameraIcon className="w-5 h-5" />
                  拍下当前视角
                </button>
            </div>
        </div>
      )}

      {showAuthModal && (
        <AuthModal
          onClose={() => {
            // Only allow closing if already logged in
            if (isLoggedIn) {
              setShowAuthModal(false);
            } else {
              toast.error('请先登录以使用系统');
            }
          }}
          onSuccess={(token) => {
            setIsLoggedIn(true);
            setShowAuthModal(false);
          }}
        />
      )}

      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />

      <Toaster position="top-right" richColors theme="dark" />
      <GlobalLoadingOverlay />
    </div>
  );
}
