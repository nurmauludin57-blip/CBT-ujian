import React, { useState } from 'react';
import {
  Award,
  CalendarClock,
  CheckCircle2,
  Clock,
  KeyRound,
  Lock,
  Megaphone,
  Play,
  ShieldAlert,
  UserCheck,
  X,
} from 'lucide-react';
import { formatDateTimeIndo } from '../lib/utils';
import type { AppCache, ExamSchedule, ToastItem, UserSession } from '../types/cbt';

interface StudentPortalViewProps {
  cache: AppCache;
  currentUser: UserSession;
  onStartExam: (exam: ExamSchedule) => void;
  showToast: (msg: string, type?: ToastItem['type']) => void;
}

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({
  cache,
  currentUser,
  onStartExam,
  showToast,
}) => {
  const [tokenModalExam, setTokenModalExam] = useState<ExamSchedule | null>(null);
  const [tokenInput, setTokenInput] = useState('');

  const studentClass = currentUser.kelas || '';
  const studentSession = currentUser.exam_session || '';
  const nowTs = Date.now();

  const activeSessionRow = cache.activeSessions.find((s) => s.student_id === currentUser.id);
  const isLocked = activeSessionRow?.status === 'TERKUNCI_PELANGGARAN';

  const matchingExams = cache.exams.filter((ex) => {
    if (ex.status !== 'aktif') return false;
    const targetCls = String(ex.targetClass || 'SEMUA').toUpperCase();
    const classMatch =
      targetCls === 'SEMUA' ||
      targetCls
        .split(',')
        .map((c) => c.trim())
        .includes(studentClass.toUpperCase());

    const targetSes = String(ex.targetSession || 'SEMUA').toUpperCase();
    const sessionMatch =
      targetSes === 'SEMUA' || targetSes === studentSession.toUpperCase();

    return classMatch && sessionMatch;
  });

  const announcements = cache.announcements.filter(
    (a) => a.is_active && (a.target_role === 'semua' || a.target_role === 'siswa')
  );

  const handleOpenTokenModal = (ex: ExamSchedule) => {
    if (isLocked) {
      showToast(
        'Akun Anda sedang terkunci karena pelanggaran tata tertib. Minta Pengawas Ruang melakukan Reset Login.',
        'error'
      );
      return;
    }
    setTokenInput('');
    setTokenModalExam(ex);
  };

  const handleVerifyToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenModalExam) return;
    if (tokenInput.trim().toUpperCase() !== tokenModalExam.token.trim().toUpperCase()) {
      showToast('Token Ujian tidak valid! Periksa papan pengumuman atau tanya Pengawas Ruang.', 'error');
      return;
    }
    const chosen = tokenModalExam;
    setTokenModalExam(null);
    onStartExam(chosen);
  };

  return (
    <div className="space-y-6 fade-in">
      {isLocked && (
        <div className="p-5 rounded-2xl bg-rose-600 text-white shadow-lg flex items-start gap-4">
          <Lock className="w-7 h-7 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-black text-base">AKUN TERKUNCI PENGAWAS</h3>
            <p className="text-xs text-rose-100 mt-1">
              Sesi ujian Anda terkunci akibat melebihi batas maksimal pelanggaran tata tertib. Silakan angkat tangan dan minta Pengawas Ruang ({currentUser.exam_room || 'Ruang 01'}) untuk membuka kunci (Reset Login).
            </p>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-indigo-600 uppercase">Kartu Identitas Peserta Aktif</p>
            <h3 className="text-lg font-black text-slate-800">{currentUser.name}</h3>
            <p className="text-xs text-slate-500 font-mono tabular-nums">
              NISN: {currentUser.identity} · Kelas {currentUser.kelas} · {currentUser.exam_room} ({currentUser.exam_session})
            </p>
          </div>
        </div>
        <div className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Siap Mengikuti Ujian
        </div>
      </div>

      {announcements.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-2">
          <h4 className="text-xs font-black uppercase text-amber-900 flex items-center gap-1.5">
            <Megaphone className="w-4 h-4 text-amber-700" /> Pengumuman &amp; Tata Tertib Peserta
          </h4>
          <div className="space-y-2">
            {announcements.slice(0, 3).map((a) => (
              <div key={a.id} className="bg-white/80 rounded-xl p-3 border border-amber-100">
                <p className="text-xs font-bold text-slate-800">{a.title}</p>
                <p className="text-xs text-slate-600 whitespace-pre-wrap mt-0.5">{a.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 mb-3">
          Daftar Jadwal Ujian Tersedia ({matchingExams.length})
        </h3>
        {matchingExams.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
            Belum ada jadwal ujian aktif untuk Kelas {studentClass} ({studentSession}) saat ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {matchingExams.map((ex) => {
              const myResult = cache.results.find(
                (r) => r.examId === ex.id && r.studentId === currentUser.id
              );
              const startTs = ex.startTime ? new Date(ex.startTime).getTime() : null;
              const endTs = ex.endTime ? new Date(ex.endTime).getTime() : null;
              const notOpenedYet = Boolean(startTs && nowTs < startTs);
              const alreadyClosed = Boolean(endTs && nowTs > endTs);

              const poolQuestionsCount = cache.questions.filter(
                (q) =>
                  q.subject === ex.subject &&
                  (ex.packetCode === 'SEMUA' || q.packetCode === ex.packetCode)
              ).length;
              const effectiveQCount =
                ex.maxQuestions > 0 ? Math.min(ex.maxQuestions, poolQuestionsCount) : poolQuestionsCount;

              return (
                <div
                  key={ex.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-bold">
                        {ex.subject} · {ex.packetCode}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                          ex.examMode === 'strict'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-sky-50 text-sky-700'
                        }`}
                      >
                        {ex.examMode === 'strict' ? 'Lockdown Ketat' : 'Mode Fleksibel'}
                      </span>
                    </div>
                    <h4 className="text-lg font-black text-slate-800">{ex.title}</h4>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> {ex.duration} Menit
                      </span>
                      {ex.sourceType === 'internal' && (
                        <span className="tabular-nums">{effectiveQCount} Butir Soal</span>
                      )}
                      {ex.examMode === 'strict' && (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-semibold tabular-nums">
                          <ShieldAlert className="w-3.5 h-3.5" /> Maks {ex.maxViolations}x Pelanggaran
                        </span>
                      )}
                    </div>
                    {(ex.startTime || ex.endTime) && (
                      <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                        <CalendarClock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {ex.startTime ? `Buka: ${formatDateTimeIndo(ex.startTime)}` : ''}{' '}
                          {ex.endTime ? `· Tutup: ${formatDateTimeIndo(ex.endTime)}` : ''}
                        </span>
                      </p>
                    )}
                  </div>

                  {myResult ? (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Ujian Sudah Diselesaikan</span>
                      </div>
                      {ex.showResult ? (
                        <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-black text-sm tabular-nums">
                          Nilai: {myResult.score}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-700">Terekam</span>
                      )}
                    </div>
                  ) : notOpenedYet ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-3 rounded-xl bg-slate-100 text-slate-500 font-bold text-xs cursor-not-allowed"
                    >
                      Jadwal Belum Dibuka
                    </button>
                  ) : alreadyClosed ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-3 rounded-xl bg-rose-50 text-rose-500 font-bold text-xs cursor-not-allowed"
                    >
                      Waktu Jadwal Ujian Telah Berakhir
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenTokenModal(ex)}
                      className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow transition inline-flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4" /> Kerjakan Ujian Sekarang
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {tokenModalExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleVerifyToken}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 fade-in space-y-4"
          >
            <div className="flex justify-between items-start gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Konfirmasi Token Ujian</h3>
                  <p className="text-xs text-slate-500">{tokenModalExam.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTokenModalExam(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
              <p>
                <strong>Durasi:</strong> {tokenModalExam.duration} menit
              </p>
              <p>
                <strong>Mode Keamanan:</strong>{' '}
                {tokenModalExam.examMode === 'strict'
                  ? `Lockdown Layar Penuh (Maks ${tokenModalExam.maxViolations}x pelanggaran)`
                  : 'Mode Fleksibel'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Masukkan Token Rilis Pengawas
              </label>
              <input
                type="text"
                required
                autoFocus
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                placeholder="MISAL: ABC123"
                className="w-full px-4 py-3 rounded-xl border-2 border-indigo-200 focus:border-indigo-600 font-mono text-center text-lg font-black uppercase tracking-widest outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setTokenModalExam(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow"
              >
                Verifikasi &amp; Mulai
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

interface StudentHistoryViewProps {
  cache: AppCache;
  currentUser: UserSession;
}

export const StudentHistoryView: React.FC<StudentHistoryViewProps> = ({ cache, currentUser }) => {
  const myResults = cache.results
    .filter((r) => r.studentId === currentUser.id)
    .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
          <Award className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-slate-800">Riwayat &amp; Hasil Ujian Saya</h3>
          <p className="text-xs text-slate-500">Rekaman ujian yang telah Anda selesaikan</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                <th className="py-3 px-4">Judul Ujian</th>
                <th className="py-3 px-4">Mata Pelajaran</th>
                <th className="py-3 px-4 text-center">Benar / Soal</th>
                <th className="py-3 px-4 text-center">Nilai</th>
                <th className="py-3 px-4">Waktu Selesai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {myResults.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    Anda belum memiliki riwayat penyelesaian ujian.
                  </td>
                </tr>
              ) : (
                myResults.map((r) => {
                  const exam = cache.exams.find((e) => e.id === r.examId);
                  const canShowScore = exam ? exam.showResult : true;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-bold text-slate-800">{r.examTitle}</td>
                      <td className="py-3.5 px-4 text-indigo-600 font-semibold">{r.subject}</td>
                      <td className="py-3.5 px-4 text-center font-mono text-xs tabular-nums">
                        {canShowScore ? `${r.correctCount} / ${r.totalQuestions}` : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {canShowScore ? (
                          <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 font-black tabular-nums">
                            {r.score}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Disembunyikan Panitia</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 tabular-nums">
                        {formatDateTimeIndo(r.submittedAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
