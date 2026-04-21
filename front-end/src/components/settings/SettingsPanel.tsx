import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  RefreshCw,
  Copy,
  Wifi,
  Pencil,
  Trash2,
  Plus,
  Key,
  ExternalLink,
  X,
  Image as ImageIcon,
  Video,
  Type,
  Star,
  Sparkles,
  Music,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { ApiProvider } from '../../types';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

type TabType = 'providers' | 'models';

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ open, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('providers');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-[600px] bg-[#0f0f12] border-l border-gray-800 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="h-14 border-b border-gray-800 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-bold text-gray-200">设置</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab('providers')}
            className={cn(
              "flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2",
              activeTab === 'providers'
                ? 'text-primary border-primary'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            )}
          >
            API 供应商
          </button>
          <button
            onClick={() => setActiveTab('models')}
            className={cn(
              "flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2",
              activeTab === 'models'
                ? 'text-primary border-primary'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            )}
          >
            默认模型设置
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'providers' ? <ProvidersTab /> : <ModelsTab />}
        </div>
      </div>
    </div>
  );
};

// ========== Providers Tab ==========
const ProvidersTab: React.FC = () => {
  const { apiProviders, syncModels, removeProvider, updateProvider, addProvider } = useSettingsStore();
  const [editingProvider, setEditingProvider] = useState<ApiProvider | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleSync = async (providerId: string) => {
    setSyncingId(providerId);
    try {
      await syncModels(providerId);
      toast.success('模型同步成功');
    } catch (error: any) {
      toast.error(error.message || '同步失败');
    } finally {
      setSyncingId(null);
    }
  };

  const handleCopyKey = (provider: ApiProvider) => {
    if (provider.apiKey) {
      navigator.clipboard.writeText(provider.apiKey);
      toast.success('API Key 已复制');
    } else {
      toast.error('暂无 API Key');
    }
  };

  const handleTestConnection = async (provider: ApiProvider) => {
    try {
      const response = await fetch(`${provider.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${provider.apiKey}` },
        method: 'GET'
      });
      if (response.ok) {
        toast.success('连接测试成功');
      } else {
        toast.error('连接测试失败');
      }
    } catch {
      toast.error('连接测试失败');
    }
  };

  const handleAddProvider = () => {
    const id = `provider-${Date.now()}`;
    const newProvider: ApiProvider = {
      id,
      name: '新供应商',
      baseUrl: 'https://api.example.com/v1',
      apiKey: '',
      models: [],
    };
    addProvider(newProvider);
    setEditingProvider(newProvider);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
          <Key className="w-5 h-5 text-yellow-500" />
          API 供应商管理
        </h2>
        <p className="text-xs text-gray-500 mt-1">配置 AI 服务供应商，管理 API Key 和模型列表</p>
      </div>

      {/* Provider List */}
      <div className="space-y-3">
        {apiProviders.map((provider) => (
          <div
            key={provider.id}
            className="bg-[#1a1a1f] border border-gray-800 rounded-xl p-4 flex items-center justify-between group hover:border-gray-700 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Key className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-200">{provider.name}</span>
                  <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{provider.id === 'ai1ge-default' ? 'memefast' : 'custom'}</span>
                  {provider.apiKey && (
                    <span className="text-[10px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded border border-green-400/20">1 Key</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {provider.models?.length || 0} 个模型
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleSync(provider.id)}
                disabled={syncingId === provider.id}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-200"
                title="同步模型"
              >
                <RefreshCw className={cn("w-4 h-4", syncingId === provider.id && "animate-spin")} />
              </button>
              <button
                onClick={() => handleCopyKey(provider)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-200"
                title="复制 Key"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleTestConnection(provider)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-200"
                title="测试连接"
              >
                <Wifi className="w-4 h-4" />
              </button>
              <button
                onClick={() => setEditingProvider(provider)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-200"
                title="编辑"
              >
                <Pencil className="w-4 h-4" />
              </button>
              {provider.id !== 'ai1ge-default' && (
                <button
                  onClick={() => removeProvider(provider.id)}
                  className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-gray-400 hover:text-red-400"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Provider */}
      <button
        onClick={handleAddProvider}
        className="w-full py-3 border-2 border-dashed border-gray-800 rounded-xl text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors flex items-center justify-center gap-2 text-sm font-bold"
      >
        <Plus className="w-4 h-4" /> 添加供应商
      </button>

      {/* Edit Provider Modal */}
      {editingProvider && (
        <EditProviderModal
          provider={editingProvider}
          onClose={() => setEditingProvider(null)}
          onSave={(updated) => {
            updateProvider(updated.id, updated);
            setEditingProvider(null);
            toast.success('保存成功');
          }}
        />
      )}
    </div>
  );
};

// ========== Edit Provider Modal ==========
const EditProviderModal: React.FC<{
  provider: ApiProvider;
  onClose: () => void;
  onSave: (provider: ApiProvider) => void;
}> = ({ provider, onClose, onSave }) => {
  const [form, setForm] = useState<ApiProvider>({ ...provider });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const isAi1ge = provider.id === 'ai1ge-default';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Content */}
      <div className="relative bg-[#1a1a1f] border border-gray-800 rounded-xl w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h3 className="text-base font-bold text-gray-200">编辑供应商</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">平台</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-[#131318] border-gray-700 text-gray-200 text-sm"
              placeholder="平台名称"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">名称</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-[#131318] border-gray-700 text-gray-200 text-sm"
              placeholder="显示名称"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Base URL (可选修改)</Label>
            <Input
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              className="bg-[#131318] border-gray-700 text-gray-200 text-sm font-mono"
              placeholder="https://api.example.com/v1"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">API Key</Label>
            <div className="relative">
              <Input
                type="password"
                id="api-key-input"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                className="bg-[#131318] border-gray-700 text-gray-200 text-sm pr-10"
                placeholder="sk-..."
              />
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('api-key-input') as HTMLInputElement;
                  if (input) input.type = input.type === 'password' ? 'text' : 'password';
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <Key className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-gray-600">支持多个 Key，用逗号分隔</p>
          </div>

          {/* Get Key Link */}
          {isAi1ge && (
            <a
              href="https://ai1ge.com/register?aff=wJh3"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl hover:bg-yellow-500/10 transition-colors group"
            >
              <Sparkles className="w-5 h-5 text-yellow-500" />
              <div className="flex-1">
                <div className="text-sm font-bold text-yellow-500 group-hover:text-yellow-400">前往 AI1哥 获取 Key</div>
                <div className="text-[10px] text-gray-500">www.ai1ge.com</div>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-yellow-500" />
            </a>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">模型 (可选)</Label>
            <Input
              value={form.models?.join(', ') || ''}
              onChange={(e) => setForm({ ...form, models: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              className="bg-[#131318] border-gray-700 text-gray-200 text-sm"
              placeholder="gpt-4, gpt-3.5-turbo..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            >
              取消
            </Button>
            <Button
              type="submit"
              className="bg-yellow-600 hover:bg-yellow-500 text-white"
            >
              保存
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ========== Models Tab ==========
const ModelsTab: React.FC = () => {
  const { defaultModels, updateDefaultModels, getImageModels, getVideoModels, getTextModels, getAudioModels } = useSettingsStore();
  const imageModels = getImageModels();
  const videoModels = getVideoModels();
  const textModels = getTextModels();
  const audioModels = getAudioModels();

  const modelRows = [
    {
      category: '文本',
      categoryColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      icon: <Type className="w-3.5 h-3.5" />,
      name: '对话模型',
      key: 'textExtraction' as const,
      options: textModels,
    },
    {
      category: '文本',
      categoryColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      icon: <Type className="w-3.5 h-3.5" />,
      name: 'AI 编辑助手',
      key: 'textExtraction' as const,
      options: textModels,
    },
    {
      category: '文本',
      categoryColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      icon: <Type className="w-3.5 h-3.5" />,
      name: '识图模型',
      key: 'textExtraction' as const,
      options: textModels,
    },
    {
      category: '图片',
      categoryColor: 'bg-green-500/10 text-green-400 border-green-500/20',
      icon: <ImageIcon className="w-3.5 h-3.5" />,
      name: '图片模型',
      key: 'imageGeneration' as const,
      options: imageModels,
    },
    {
      category: '视频',
      categoryColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      icon: <Video className="w-3.5 h-3.5" />,
      name: '视频模型',
      key: 'videoGeneration' as const,
      options: videoModels,
    },
    {
      category: '音频',
      categoryColor: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      icon: <Music className="w-3.5 h-3.5" />,
      name: '音频模型',
      key: 'audioGeneration' as const,
      options: audioModels,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          默认模型设置
        </h2>
        <p className="text-xs text-gray-500 mt-1">将 AI 功能映射到具体的供应商和模型，支持多选轮询调度</p>
      </div>

      {/* Table */}
      <div className="border border-gray-800 rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[80px_1fr_1fr] gap-4 px-4 py-3 bg-[#1a1a1f] border-b border-gray-800 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
          <span>分类</span>
          <span>功能名</span>
          <span>默认模型</span>
        </div>

        {/* Table Rows */}
        {modelRows.map((row, idx) => (
          <div
            key={idx}
            className="grid grid-cols-[80px_1fr_1fr] gap-4 px-4 py-3 border-b border-gray-800/50 items-center hover:bg-[#1a1a1f]/50 transition-colors"
          >
            <div>
              <span className={cn(
                "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border",
                row.categoryColor
              )}>
                {row.category}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-200 font-bold">
              {row.icon}
              {row.name}
            </div>
            <div>
              {row.key ? (
                <div className="relative">
                  <select
                    value={defaultModels[row.key]}
                    onChange={(e) => updateDefaultModels({ [row.key]: e.target.value })}
                    className="w-full bg-[#131318] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none appearance-none cursor-pointer hover:border-gray-600 transition-colors"
                  >
                    {row.options.length > 0 ? (
                      row.options.map((model) => (
                        <option key={model.id} value={model.id} className="bg-[#1a1a1f]">
                          {model.name}
                        </option>
                      ))
                    ) : (
                      <option value={defaultModels[row.key]} className="bg-[#1a1a1f]">
                        {defaultModels[row.key]}
                      </option>
                    )}
                  </select>
                  <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              ) : (
                <span className="text-xs text-gray-600">未设置默认模型</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <Star className="w-3.5 h-3.5 text-yellow-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-gray-500 leading-relaxed">
            <span className="text-gray-400 font-bold">默认模型：</span>这里设置的模型是各功能的默认模型，在画布节点和编辑器生成弹窗中会作为预选项。用户在具体使用时仍可自由切换到其他可用模型。
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-purple-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-gray-500 leading-relaxed">
            <span className="text-gray-400 font-bold">说明：</span>可选项来自「API 供应商」里配置的模型列表。未设置时将自动使用内置默认模型。
          </p>
        </div>
      </div>
    </div>
  );
};
