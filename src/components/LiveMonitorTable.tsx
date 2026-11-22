import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  Lock,
  MessageSquare,
  MoreVertical,
  Pause,
  PenLine,
  Redo2,
  ShieldAlert,
  Unlock,
} from 'lucide-react';
import { doesSessionMatchRoom } from '../lib/utils';
import type { ActiveSession } from '../types/cbt';

interface LiveMonitorTableProps {
  sessions: ActiveSession[];
  roomFilter?: string | null;
  onOpenPushMessage: (studentId: string, studentName: string) => void;
  onGrantExtraTime: (studentId: string, studentName: string, minutes?: number) => void;
  onSupervisorAction: (studentId: string, studentName: string, actionCode: string) => void;
  onResetLogin: (studentId: string, studentName: string) => void;
  onResetExam: (studentId: string, studentName: string, examTitle: string) => void;
}

export const LiveMonitorTable: React.FC<LiveMonitorTableProps> = ({
  sessions,
  roomFilter = null,
  onOpenPushMessage,
  onGrantExtraTime,
  onSupervisorAction,
  onResetLogin,
  onResetExam,
}) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const now = Date.now();
  const onlineList = sessions.filter((s) => {
    const isLockedViol = s.status === 'TERKUNCI_PELANGGARAN';
    const last = new Date(s.last_seen).getTime();
    if (!isLockedViol && now - last > 45000) return false;
    return doesSessionMatchRoom(s, roomFilter);
  });

  if (onlineList.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        Belum ada siswa yang sedang online{' '}
        {roomFilter && roomFilter !== 'ALL' ? (
          <>
            di <strong>{roomFilter}</strong>
          </>
        ) : (
          'saat ini'
        )}
        .
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
            <th className="py-3 px-4">Nama Siswa &amp; Kelas</th>
            <th className="py-3 px-4">Ruang Ujian</th>
            <th className="py-3 px-4">Status Aktivitas</th>
            <th className="py-3 px-4">Ujian &amp; Progres Cloud</th>
            <th className="py-3 px-4 text-center">Pelanggaran</th>
            <th className="py-3 px-4 text-right">Remote Kontrol &amp; Menu Tambahan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {onlineList.map((s) => {
            const isLockedViol = s.status === 'TERKUNCI_PELANGGARAN';
            const isWorking = s.status === 'SEDANG_UJIAN';
            const hasViol = Number(s.violations) > 0 || isLockedViol;
            const isPaused = Boolean(s.is_paused);

            return (
              <tr
                key={s.student_id}
                className={
                  isLockedViol
                    ? 'bg-rose-100/90'
                    : hasViol
                    ? 'bg-rose-50/80'
                    : 'hover:bg-slate-50'
                }
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        hasViol ? 'bg-rose-600' : isWorking ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    />
                    <div>
                      <p className="font-bold text-slate-800">{s.student_name}</p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        {s.student_identity} · {s.student_class}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-xs font-bold text-indigo-700">{s.exam_room || 'Ruang 01'}</td>
                <td className="py-3 px-4">
                  {isLockedViol ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-600 text-white shadow-sm">
                      <Lock className="w-3 h-3" /> Terkunci (Batas Pelanggaran)
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        isPaused
                          ? 'bg-amber-200 text-amber-950'
                          : isWorking
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {isPaused ? (
                        <>
                          <Pause className="w-3 h-3" /> Dijeda
                        </>
                      ) : isWorking ? (
                        <>
                          <PenLine className="w-3 h-3" /> Sedang Ujian
                        </>
                      ) : (
                        'Online di Portal'
                      )}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-xs">
                  <p className="font-semibold text-slate-700">{s.exam_title}</p>
                  <p className="text-slate-500 tabular-nums">{s.progress}</p>
                </td>
                <td className="py-3 px-4 text-center">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-extrabold tabular-nums ${
                      hasViol ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {s.violations || 0}x
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenPushMessage(s.student_id, s.student_name)}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <MessageSquare className="w-3 h-3" /> Pesan
                    </button>
                    {isWorking && (
                      <>
                        <button
                          type="button"
                          onClick={() => onGrantExtraTime(s.student_id, s.student_name, 5)}
                          className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-[11px] font-bold transition whitespace-nowrap"
                          title="Tambah Waktu Darurat +5 Menit"
                        >
                          +5m
                        </button>
                        <button
                          type="button"
                          onClick={() => onSupervisorAction(s.student_id, s.student_name, 'FORCE_SUBMIT')}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold transition whitespace-nowrap"
                          title="Paksa Kumpulkan Ujian"
                        >
                          Kumpul
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => onSupervisorAction(s.student_id, s.student_name, 'KICK')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition whitespace-nowrap"
                    >
                      Kick
                    </button>

                    <div className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId((prev) => (prev === s.student_id ? null : s.student_id));
                        }}
                        className={`px-2.5 py-1.5 rounded-lg ${
                          hasViol || isLockedViol
                            ? 'bg-rose-600 hover:bg-rose-700 text-white'
                            : 'bg-slate-800 hover:bg-slate-900 text-white'
                        } text-[11px] font-extrabold shadow-sm transition inline-flex items-center gap-1 whitespace-nowrap`}
                      >
                        <MoreVertical className="w-3 h-3" />
                        <span>Menu Tambahan</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {openMenuId === s.student_id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="origin-top-right absolute right-0 mt-1.5 w-52 rounded-2xl shadow-2xl bg-white ring-1 ring-slate-200 z-40 overflow-hidden text-left"
                        >
                          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                              Menu Tambahan Peserta
                            </p>
                          </div>
                          <div className="p-1.5 space-y-1">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                onResetExam(s.student_id, s.student_name, s.exam_title || '');
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl hover:bg-purple-50 text-purple-700 text-xs font-bold flex items-center gap-2.5 transition"
                            >
                              <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                                <Redo2 className="w-3.5 h-3.5" />
                              </span>
                              <div>
                                <p className="leading-tight">Reset Ujian</p>
                                <p className="text-[10px] font-normal text-slate-400">Ulang ujian dari awal</p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                onResetLogin(s.student_id, s.student_name);
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-2.5 transition"
                            >
                              <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                                <Unlock className="w-3.5 h-3.5" />
                              </span>
                              <div>
                                <p className="leading-tight">Reset Login</p>
                                <p className="text-[10px] font-normal text-slate-400">Buka kunci sesi masuk</p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                onSupervisorAction(s.student_id, s.student_name, 'RESET_VIOLATIONS');
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl hover:bg-amber-50 text-amber-800 text-xs font-bold flex items-center gap-2.5 transition"
                            >
                              <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                                <ShieldAlert className="w-3.5 h-3.5" />
                              </span>
                              <div>
                                <p className="leading-tight">Reset Pelanggaran</p>
                                <p className="text-[10px] font-normal text-slate-400">Nolkan hitung pelanggaran</p>
                              </div>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
