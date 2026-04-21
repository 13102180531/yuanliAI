import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Clapperboard, 
  Database, 
  Layers, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  Zap,
  ZapOff,
  LayoutGrid
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGenerationSocket } from '@/hooks/useGenerationSocket';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  activeTab: 'script' | 'assets' | 'storyboard' | 'canvas';
  setActiveTab: (tab: 'script' | 'assets' | 'storyboard' | 'canvas') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const [collapsed, setCollapsed] = React.useState(false);
  const { isConnected } = useGenerationSocket();

  const menuItems = [
    { id: 'script', icon: Clapperboard, label: '剧本导入' },
    { id: 'assets', icon: Database, label: '资产库' },
    { id: 'storyboard', icon: Layers, label: '分镜流' },
    { id: 'canvas', icon: LayoutGrid, label: '无限画布' },
  ];

  return (
    <div className={cn(
      "h-full border-r border-secondary flex flex-col transition-all duration-300 relative group z-40 shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.5)]",
      collapsed ? "w-16" : "w-64"
    )} style={{ backgroundColor: 'var(--card-bg)' }}>
      <div className="p-6 h-[60px] flex items-center shrink-0">
        {!collapsed && <span className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase opacity-60">业务单元</span>}
      </div>

      <nav className="flex-1 p-3 space-y-2">
        {menuItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 px-3 rounded-none border-l-2 transition-all",
              activeTab === item.id 
                ? "border-primary bg-primary/5 text-primary" 
                : "border-transparent text-muted-foreground hover:bg-muted/30",
              collapsed && "justify-center px-0 border-l-0"
            )}
            onClick={() => setActiveTab(item.id as any)}
          >
            <item.icon className={cn("w-4 h-4 shrink-0", activeTab === item.id && "drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]")} />
            {!collapsed && <span className="text-[11px] font-bold uppercase tracking-wider">{item.label}</span>}
          </Button>
        ))}
      </nav>

      <div className="p-3 border-t border-secondary space-y-2 mb-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={isConnected ? 'connected' : 'disconnected'}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={cn(
              "flex items-center gap-3 px-3 py-2 border font-mono",
              isConnected 
                ? "bg-primary/5 border-primary/20 text-primary" 
                : "bg-destructive/5 border-destructive/20 text-destructive",
              collapsed && "justify-center px-0 bg-transparent border-transparent"
            )}
          >
            {isConnected ? (
              <Zap className={cn("w-3.5 h-3.5", isConnected && "animate-pulse")} />
            ) : (
              <ZapOff className="w-3.5 h-3.5" />
            )}
            {!collapsed && (
              <span className="text-[9px] font-black uppercase tracking-widest truncate">
                {isConnected ? '内核脉冲: 已建立联通' : '内核脉冲: 联通已中断'}
              </span>
            )}
          </motion.div>
        </AnimatePresence>

        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 px-3 text-muted-foreground rounded-none",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="text-[11px] font-bold uppercase tracking-wider">退出登录</span>}
        </Button>
      </div>

      <Button
        variant="outline"
        size="icon"
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-none shadow-[0_0_15px_rgba(0,0,0,1)] bg-secondary border-secondary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all duration-200 z-50 cursor-pointer border hover:border-primary active:scale-95"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setCollapsed(!collapsed);
        }}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </Button>
    </div>
  );
};
