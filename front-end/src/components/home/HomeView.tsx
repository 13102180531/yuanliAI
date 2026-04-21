import React from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, LayoutDashboard, User, MapPin, Box, Calendar, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

export const HomeView: React.FC = () => {
  const projectsMap = useProjectStore(s => s.projects);
  const projects = Object.values(projectsMap).sort((a, b) => b.createdAt - a.createdAt);
  const createProject = useProjectStore(s => s.createProject);
  const setCurrentProject = useProjectStore(s => s.setCurrentProject);

  const deleteProject = useProjectStore(s => s.deleteProject);

      const handleCreate = () => {
    const newId = createProject(`草稿_${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
    setCurrentProject(newId);
  };

  const handleSelect = (id: string) => {
    setCurrentProject(id);
  };

  return (
    <div className="w-full h-full max-w-7xl mx-auto px-6 py-12 flex flex-col">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-[0.2em] mb-2">作业区 <span className="text-primary text-sm opacity-60 ml-2">WORKSPACE</span></h1>
          <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold opacity-60">
            管理您的所有 IP 开发项目与资产记录
          </p>
        </div>
        <Button 
          onClick={handleCreate}
          className="h-12 px-6 rounded-none font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          增补新工作流
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-secondary bg-black/20 text-muted-foreground">
          <LayoutDashboard className="w-12 h-12 mb-4 opacity-20" />
          <p className="font-mono text-sm uppercase tracking-widest opacity-60">空空如也，系统当前没有任何持久化数据。</p>
          <Button 
            onClick={handleCreate}
            variant="outline"
            className="mt-6 rounded-none border-secondary hover:border-primary hover:text-primary transition-all font-mono uppercase tracking-widest"
          >
            初始化第一个剧本
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj, i) => (
            <motion.div
              key={proj.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card 
                className="group cursor-pointer rounded-none border-secondary bg-card/50 hover:bg-card hover:border-primary transition-all duration-300 relative overflow-hidden"
                onClick={() => handleSelect(proj.id)}
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-primary transform origin-bottom scale-y-0 group-hover:scale-y-100 transition-transform duration-300" />
                
                {/* Delete Button */}
                <button
                   className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:bg-destructive/20 hover:text-destructive z-10 rounded-none transition-all duration-200 p-2 flex items-center justify-center"
                   onClick={(e) => {
                     e.preventDefault();
                     e.stopPropagation();
                     if (window.confirm('确认删除该序列档案及所有资产记录？')) {
                       deleteProject(proj.id);
                     }
                   }}
                >
                   <Trash2 className="w-4 h-4" />
                </button>

                <CardContent className="p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-black uppercase tracking-wider text-foreground group-hover:text-primary transition-colors">
                      {proj.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-2 text-xs font-mono text-muted-foreground opacity-60">
                      <Calendar className="w-3 h-3" />
                      {new Date(proj.createdAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  
                  <div className="flex gap-4 pt-4 border-t border-secondary font-mono text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 opacity-60" />
                      <span className="font-bold">{proj.assets.characters.length}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 opacity-60" />
                      <span className="font-bold">{proj.assets.scenes.length}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Box className="w-3.5 h-3.5 opacity-60" />
                      <span className="font-bold">{proj.assets.props.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
