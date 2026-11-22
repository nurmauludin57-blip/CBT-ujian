import React, { useState } from 'react';
import {
  AlertCircle,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Layers,
  MessageSquare,
  RotateCcw,
  Unlock,
  VolumeX,
  X,
} from 'lucide-react';
import type { ExamRoom, SupervisorAlertItem, ToastItem } from '../types/cbt';

interface SupervisorAlertBannerProps {
  queue: SupervisorAlertItem[];
  queueIndex: number;
  rooms: ExamRoom[];
  activeProctorRoom: string;
  onNavigateQueue: (delta: number) => void;
  onDismissCurrent: () => void;
  onDismissAll: () => void;
  onVerifyRoomCode: (code: string, targetRoom: string, item: SupervisorAlertItem) => void;
  onResetLogin: (studentId: string, studentName: string) => void;
  onResetViolations: (studentId: string, studentName: string) => void;
  onOpenPushMessage: (studentId: string, studentName: string) => void;
  showToast: (msg: string, type?: ToastItem['type']) => void;
}

export const SupervisorAlertBanner: React.FC<SupervisorAlertBannerProps> = ({
  queue,
  queueIndex,
  rooms,
  activeProctorRoom,
  onNavigateQueue,
  onDismissCurrent,
  onDismissAll,
  onVerifyRoomCode,
  onResetLogin,
  onResetViolations,
  onOpenPushMessage,
  showToast,
}) => {
  const [roomCodeInput, setRoomCodeInput] = useState('');

  if (queue.length === 0) return null;

  const safeIdx = queueIndex >= queue.length ? 0 : queueIndex;
  const item = queue[safeIdx];
  const isLockedViol = item.status === 'TERKUNCI_PELANGGARAN';

  const handleVerify = () => {
    const code = roomCodeInput.trim().toUpperCase();
    if (!code) {
      showToast('Masukkan Kode / PIN Ruang terlebih dahulu!', 'warning');
      return;
    }
    const targetRoomName = item.exam_room || activeProctorRoom || 'Ruang 01';
    const roomObj = rooms.find((r) => r.name === targetRoomName);
    const validPin = String(roomObj?.room_pin || '').trim().toUpperCase();
    if ((validPin && code === validPin) || (!validPin && code === 'ADMIN') || code === 'ADMIN') {
      setRoomCodeInput('');
      onVerifyRoomCode(code, targetRoomName, item);
    } else {
      showToast(`Kode / PIN Ruang untuk ${targetRoomName} tidak sesuai!`, 'error');
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-[calc(100%-2.5rem)] bg-rose-950 text-white rounded-3xl p-5 shadow-2xl border-4 border-rose-500 fade-in">
      {queue.length > 1 && (
        <div className="mb-3 pb-2.5 border-b border-rose-700/70 flex items-center justify-between gap-2 text-[11px]">
          <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black inline-flex items-center gap-1">
            <Layers className="w-3 h-3" /> Antrean {safeIdx + 1} / {queue.length}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setRoomCodeInput('');
                onNavigateQueue(-1);
              }}
              className="px-2 py-0.5 rounded-lg bg-rose-800 hover:bg-rose-700 text-white font-bold"
              title="Pelanggaran Sebelumnya"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setRoomCodeInput('');
                onNavigateQueue(1);
              }}
              className="px-2 py-0.5 rounded-lg bg-rose-800 hover:bg-rose-700 text-white font-bold"
              title="Pelanggaran Berikutnya"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onDismissAll}
              className="px-2 py-0.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-rose-100 font-bold"
            >
              Tutup Semua
            </button>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 animate-bounce shadow-lg">
          <Bell className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-rose-200 text-[10px] font-extrabold uppercase tracking-wider">
              SIRINE PENGAWAS · PELANGGARAN TERDETEKSI
            </span>
            <button
              type="button"
              onClick={onDismissCurrent}
              className="text-rose-300 hover:text-white"
              title="Tutup & Matikan Sirine"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <h4 className="text-base font-black text-white mt-1 truncate">
            {item.student_name} ({item.student_class})
          </h4>
          <p className="text-xs text-rose-200 mt-0.5">
            {isLockedViol
              ? `${item.exam_room} · TERKUNCI BATAS PELANGGARAN (${item.violations}x)`
              : `${item.exam_room} · Terdeteksi Pelanggaran ke-${item.violations}x`}
          </p>
          <div className="mt-1.5 px-2.5 py-1.5 rounded-xl bg-rose-900/80 border border-rose-500/40 text-[11px] text-amber-200 font-semibold leading-snug flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Alasan: {item.reason}</span>
          </div>
          <p className="text-[11px] text-rose-300/90 mt-1.5 truncate">Ujian: {item.exam_title}</p>

          <div className="mt-2.5 flex items-center gap-1.5">
            <input
              type="text"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleVerify();
                }
              }}
              placeholder="Kode/PIN Ruang..."
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-rose-900/70 border border-rose-500/50 text-white placeholder-rose-300/70 font-mono text-[11px] uppercase font-bold outline-none focus:border-amber-400"
            />
            <button
              type="button"
              onClick={handleVerify}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-[11px] transition shrink-0 inline-flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" /> Kode Ruang
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onDismissCurrent}
              className="px-3 py-1.5 rounded-xl bg-white text-rose-950 hover:bg-rose-100 font-extrabold text-xs transition inline-flex items-center gap-1.5"
            >
              <VolumeX className="w-3.5 h-3.5" /> Matikan Sirine
            </button>
            {(isLockedViol || item.violations > 0) && (
              <button
                type="button"
                onClick={() => onResetLogin(item.student_id, item.student_name)}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white border border-rose-300/50 font-extrabold text-xs transition inline-flex items-center gap-1.5 shadow"
              >
                <Unlock className="w-3.5 h-3.5" /> Reset Login
              </button>
            )}
            <button
              type="button"
              onClick={() => onResetViolations(item.student_id, item.student_name)}
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs transition inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Pelanggaran
            </button>
            <button
              type="button"
              onClick={() => onOpenPushMessage(item.student_id, item.student_name)}
              className="px-3 py-1.5 rounded-xl bg-rose-800 hover:bg-rose-700 text-white border border-rose-500/50 font-bold text-xs transition inline-flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Tegur
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
