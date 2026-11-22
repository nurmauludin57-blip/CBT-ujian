import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Database,
  Download,
  Info,
  KeyRound,
  X,
} from 'lucide-react';
import { SUPABASE_SQL_V5, ensureSupabase } from '../lib/supabase';
import type { ToastItem, UserSession } from '../types/cbt';

interface GlobalLoaderProps {
  visible: boolean;
  text: string;
}

export const GlobalLoader: React.FC<GlobalLoaderProps> = ({ visible, text }) => {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-7 shadow-2xl flex flex-col items-center gap-3 max-w-xs w-full text-center">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
        <p className="text-sm font-bold text-slate-800">{text || 'Menghubungkan ke Cloud...'}</p>
        <p className="text-xs text-slate-400">Mohon tunggu sebentar</p>
      </div>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;
  const styles: Record<ToastItem['type'], string> = {
    success: 'bg-emerald-600 text-white border-emerald-500',
    error: 'bg-rose-600 text-white border-rose-500',
    warning: 'bg-amber-500 text-slate-950 border-amber-400',
    info: 'bg-slate-900 text-white border-slate-700',
  };

  return (
    <div className="fixed top-5 right-5 z-[70] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-2xl shadow-xl border text-xs font-bold fade-in ${styles[t.type]}`}
        >
          {t.type === 'success' && <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
          {t.type === 'error' && <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
          {t.type === 'warning' && <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          {t.type === 'info' && <Info className="w-4 h-4 mt-0.5 shrink-0" />}
          <div className="flex-1 leading-relaxed">{t.message}</div>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="opacity-70 hover:opacity-100 shrink-0"
            aria-label="Tutup notifikasi"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

interface SqlSchemaModalProps {
  open: boolean;
  onClose: () => void;
  showToast: (msg: string, type?: ToastItem['type']) => void;
}

export const SqlSchemaModal: React.FC<SqlSchemaModalProps> = ({ open, onClose, showToast }) => {
  if (!open) return null;

  const handleCopy = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(SUPABASE_SQL_V5).then(() => {
        showToast('Skrip SQL v5.0 berhasil disalin ke clipboard!', 'success');
      });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([SUPABASE_SQL_V5], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supabase_educbt_v5_normalized.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-indigo-100 text-indigo-600">
            <Database className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-slate-800">Skema SQL Supabase v5.0 (15 Tabel Terpisah)</h3>
            <p className="text-xs text-slate-600 mt-1">
              Salin skrip SQL di bawah ini dan jalankan di <strong>SQL Editor Supabase</strong> Anda untuk membuat seluruh tabel terpisah secara otomatis:
            </p>
            <textarea
              readOnly
              rows={13}
              value={SUPABASE_SQL_V5}
              className="w-full mt-3 p-3 rounded-xl bg-slate-900 text-emerald-300 font-mono text-[11px] outline-none"
            />
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={handleCopy}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" /> Salin Skrip SQL
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Unduh File (.sql)
              </button>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

interface ChangePasswordModalProps {
  open: boolean;
  user: UserSession | null;
  onClose: () => void;
  setLoading: (val: boolean, text?: string) => void;
  showToast: (msg: string, type?: ToastItem['type']) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  open,
  user,
  onClose,
  setLoading,
  showToast,
}) => {
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');

  if (!open || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPwd || !newPwd.trim()) {
      showToast('Isi kata sandi lama dan baru!', 'warning');
      return;
    }
    setLoading(true, 'Memperbarui kata sandi...');
    try {
      const sb = ensureSupabase();
      const { data, error } = await sb.rpc('cbt_change_own_password', {
        p_user_id: user.id,
        p_old_password: oldPwd,
        p_new_password: newPwd.trim(),
      });
      if (error) throw error;
      if (!data) {
        showToast('Kata sandi lama tidak sesuai!', 'error');
        return;
      }
      showToast('Kata sandi berhasil diperbarui!', 'success');
      setOldPwd('');
      setNewPwd('');
      onClose();
    } catch (err) {
      showToast('Gagal mengubah kata sandi: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 fade-in"
      >
        <div className="flex items-start gap-4 mb-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Ubah Kata Sandi Akun</h3>
            <p className="text-xs text-slate-500 mt-0.5">Perbarui sandi masuk untuk akun {user.username}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Kata Sandi Lama</label>
            <input
              type="password"
              required
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Kata Sandi Baru</label>
            <input
              type="password"
              required
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-indigo-500"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Batal
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Simpan Sandi Baru
          </button>
        </div>
      </form>
    </div>
  );
};

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  confirmTone?: 'indigo' | 'rose' | 'emerald' | 'amber';
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  message,
  confirmText = 'Ya, Lanjutkan',
  confirmTone = 'indigo',
  onConfirm,
  onClose,
}) => {
  if (!open) return null;
  const toneCls: Record<string, string> = {
    indigo: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    rose: 'bg-rose-600 hover:bg-rose-700 text-white',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    amber: 'bg-amber-500 hover:bg-amber-600 text-slate-950',
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 fade-in">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <div className="text-sm text-slate-600 mt-1.5 leading-relaxed">{message}</div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
            className={`px-5 py-2 rounded-xl text-sm font-semibold shadow-sm transition ${toneCls[confirmTone]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
