import React, { useState, useEffect } from 'react';
import { Mail, Shield, Lock, ArrowRight, UserPlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (token: string) => void;
}

export function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [canClose, setCanClose] = useState(false);

  const [form, setForm] = useState({
    email: '',
    password: '',
    code: '',
    remember: true
  });

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('xueding_token');
    setCanClose(!!token);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const toggleMode = (newMode: 'login' | 'register' | 'reset') => {
    setMode(newMode);
    setForm(prev => ({ ...prev, password: '', code: '' }));
  };

  const sendCode = async () => {
    if (!form.email) return toast.error('请输入邮箱');

    setSendingCode(true);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const res = await fetch(`${apiBaseUrl}/api/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          type: mode === 'reset' ? 'reset' : 'register'
        })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || '验证码已发送，请查收邮件 (本地开发请看后台日志)');
        setCountdown(60);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || '发送验证码失败');
      }
    } catch (e) {
      toast.error('请求失败，请检查网络连接');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

    let endpoint = '';
    let payload: any = {};

    if (mode === 'login') {
      endpoint = `${apiBaseUrl}/api/auth/login`;
      payload = { email: form.email, password: form.password };
    } else if (mode === 'register') {
      endpoint = `${apiBaseUrl}/api/auth/register`;
      payload = { email: form.email, password: form.password, code: form.code };
    } else if (mode === 'reset') {
      endpoint = `${apiBaseUrl}/api/auth/reset-password`;
      payload = { email: form.email, newPassword: form.password, code: form.code };
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();

        toast.success(data.message || (mode === 'login' ? '登录成功！' : mode === 'register' ? '注册成功！' : '密码重置成功！'));

        if (mode === 'login') {
          const token = data.token;
          localStorage.setItem('xueding_token', token);
          onSuccess(token);
          onClose();
        } else if (mode === 'register') {
          const token = data.token;
          localStorage.setItem('xueding_token', token);
          setTimeout(() => {
            onSuccess(token);
            onClose();
          }, 1500);
        } else if (mode === 'reset') {
          setTimeout(() => {
            toggleMode('login');
          }, 1500);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || '操作失败');
      }
    } catch (e) {
      toast.error('网络错误，请检查后端服务是否启动');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-[420px] relative">
        {/* Close Button - only show if user can close */}
        {canClose && (
          <button
            onClick={onClose}
            className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
        )}

        {/* Login/Register Card */}
        <div className="bg-white rounded-[24px] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-gray-100">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-blue-600 font-bold text-sm tracking-[2px] mb-4">愿力AI</div>
            <h1 className="text-3xl font-extrabold text-[#1a1a1a] mb-2">
              {mode === 'login' ? '用户登录' : mode === 'register' ? '用户注册' : '重置密码'}
            </h1>
            <p className="text-gray-500 text-sm">
              {mode === 'login' ? '欢迎回来，继续你的创作旅程。' : mode === 'register' ? '创建您的账号，开启全新的创作体验。' : '重置您的密码，找回账号访问权限。'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Email Input */}
            <div>
              <label className="block text-gray-600 text-sm font-medium mb-2 flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" /> 邮箱
              </label>
              <input 
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                type="email" 
                required
                placeholder="请输入邮箱" 
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-gray-700 bg-white"
              />
            </div>

            {/* Verification Code (Only in Register and Reset mode) */}
            {(mode === 'register' || mode === 'reset') && (
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gray-400" /> 验证码
                </label>
                <div className="flex gap-3">
                  <input
                    value={form.code}
                    onChange={e => setForm({...form, code: e.target.value})}
                    type="text"
                    required
                    placeholder="请输入验证码"
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-gray-700 bg-white"
                  />
                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={countdown > 0 || !form.email || sendingCode}
                    className="px-4 py-3 bg-blue-50 text-blue-600 rounded-xl font-medium text-sm hover:bg-blue-100 transition-colors whitespace-nowrap min-w-[100px] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingCode ? '发送中' : (countdown > 0 ? countdown + 's后重发' : '获取验证码')}
                  </button>
                </div>
              </div>
            )}

            {/* Password Input */}
            <div>
              <label className="block text-gray-600 text-sm font-medium mb-2 flex items-center gap-2">
                <Lock className="w-4 h-4 text-gray-400" /> {mode === 'reset' ? '新密码' : '密码'}
              </label>
              <input
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                type="password"
                required
                placeholder={mode === 'login' ? '请输入密码' : mode === 'register' ? '请设置密码' : '请输入新密码'}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-gray-700 bg-white"
              />
            </div>

            {/* Remember Me & Forgot Password (Only in Login) */}
            {mode === 'login' && (
              <div className="flex items-center justify-between mt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={form.remember}
                      onChange={e => setForm({...form, remember: e.target.checked})}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                  <span className="text-sm text-gray-600">记住我</span>
                </label>
                <button
                  type="button"
                  onClick={() => toggleMode('reset')}
                  className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
                >
                  忘记密码?
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-[#006FEE] text-white font-medium py-3.5 rounded-xl hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {!loading && (mode === 'login' ? <ArrowRight className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />)}
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {loading ? '处理中...' : (mode === 'login' ? '登录' : mode === 'register' ? '注册' : '重置密码')}
            </button>
          </form>
        </div>

        {/* Toggle Login/Register Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-300">
            {mode === 'login' ? '还没有账号？' : mode === 'register' ? '已有账号？' : '返回登录？'}
            <button
              onClick={() => toggleMode(mode === 'login' ? 'register' : 'login')}
              className="text-blue-400 font-medium hover:text-blue-300 ml-1 cursor-pointer transition-colors"
            >
              {mode === 'login' ? '立即注册' : '立即登录'}
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}
