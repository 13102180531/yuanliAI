import React from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Sparkles } from 'lucide-react';

export const GlobalLoadingOverlay: React.FC = () => {
  const isGlobalLoading = useProjectStore(s => s.isGlobalLoading);
  const globalLoadingMessage = useProjectStore(s => s.globalLoadingMessage);

  return (
    <AnimatePresence>
      {isGlobalLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md cursor-wait select-none"
        >
          <div className="flex flex-col items-center max-w-md px-6 text-center">
            <div className="relative mb-8">
              <div className="absolute inset-0 animate-ping bg-primary/20 rounded-full blur-xl" />
              <div className="relative w-20 h-20 bg-card border border-primary/20 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-xl font-black uppercase tracking-[0.2em] text-foreground flex items-center justify-center gap-3">
                {globalLoadingMessage || '内核数据交汇中'}
                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              </h2>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest leading-loose opacity-60">
                系统正在建立神经元映射，此过程包含大量的跨向量计算。<br />
                数据流同步期间，所有并发进程已自动挂起。
              </p>
            </div>

            <div className="mt-12 flex gap-1">
              {[...Array(3)].map((_, i) => (
                <div 
                  key={i}
                  className="w-1.5 h-1.5 bg-primary animate-bounce" 
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
