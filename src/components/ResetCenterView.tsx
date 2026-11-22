import React, { useState } from 'react';
import { Lock, Redo2, RotateCcw, ShieldAlert, Unlock, Wrench } from 'lucide-react';
import { ensureSupabase } from '../lib/supabase';
import { formatDateTimeIndo, getUnifiedViolationRecords, resolveViolationReason } from '../lib/utils';
import type { AppCache, ToastItem, UserSession } from '../types/cbt';

interface ResetCenterViewProps {
  cache: AppCache;
  currentUser: UserSession;
  activeProctorRoom: string;
  onSync: () => Promise<void>;
  onResetLogin: (studentId: string, studentName: string) => Promise<void>;
  onRemoveFromAlertQueue: (studentId: string) => void;
  setLoading: (val: boolean, text?: string) => void;
  showToast: (msg: string, type?: ToastItem['type']) => void;
}

export const ResetCenterView: React.FC<ResetCenterViewProps> = ({
  cache,
  currentUser,
  activeProctorRoom,
  onSync,
  onResetLogin,
  onRemoveFromAlertQueue,
  setLoading,
  showToast,
}) => {
  const [subTab, setSubTab] = useState<'login' | 'exam' | 'violation'>('login');
  const [loginSearch, setLoginSearch] = useState('');
  const [loginRoom, setLoginRoom] = useState('ALL');
  const [retakeSearch, setRetakeSearch] = useState('');
  const [retakeExam, setRetakeExam] = useState('ALL');
  const [retakeClass, setRetakeClass] = useState('ALL');
  const [violSearch, setViolSearch] = useState('');

  const isAdmin = currentUser.role === 'admin';
  const assignedRoom = !isAdmin ? String(activeProctorRoom || currentUser.proctor_room || '').trim() : 'ALL';
  const isRoomRestricted = !isAdmin && Boolean(assignedRoom) && assignedRoom.toUpperCase() !== 'ALL';

  const roomStudentIds = new Set(
    cache.students
      .filter((s) => !isRoomRestricted || (s.exam_room || '').trim().toLowerCase() === assignedRoom.toLowerCase())
      .map((s) => s.id)
  );

  const activeSessions = cache.activeSessions.filter(
    (s) =>
      !isRoomRestricted ||
      (s.exam_room || '').trim().toLowerCase() === assignedRoom.toLowerCase() ||
      roomStudentIds.has(s.student_id)
  );

  const results = [...cache.results]
    .filter((r) => !isRoomRestricted || roomStudentIds.has(r.studentId))
    .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());

  const violationRecords = getUnifiedViolationRecords(cache).filter(
    (v) =>
      !isRoomRestricted ||
      (v.exam_room || '').trim().toLowerCase() === assignedRoom.toLowerCase() ||
      roomStudentIds.has(v.student_id)
  );

  const lockedCount = activeSessions.filter((s) => s.status === 'TERKUNCI_PELANGGARAN').length;

  const filteredLogins = activeSessions.filter((s) => {
    const q = loginSearch.trim().toLowerCase();
    const okText = !q || `${s.student_name} ${s.student_identity} ${s.student_class} ${s.exam_room} ${s.exam_title}`.toLowerCase().includes(q);
    const okRoom = loginRoom === 'ALL' || (s.exam_room || 'Ruang 01') === loginRoom;
    return okText && okRoom;
  });

  const filteredResults = results.filter((r) => {
    const q = retakeSearch.trim().toLowerCase();
    const okText = !q || `${r.studentName} ${r.studentIdentity} ${r.studentClass} ${r.examTitle} ${r.subject}`.toLowerCase().includes(q);
    const okEx = retakeExam === 'ALL' || r.examId === retakeExam;
    const okCls = retakeClass === 'ALL' || r.studentClass === retakeClass;
    return okText && okEx && okCls;
  });

  const violatorMap = new Map<
    string,
    {
      student_id: string;
      student_name: string;
      student_identity: string;
      student_class: string;
      exam_room: string;
      exam_title: string;
      violations: number;
      last_reason: string;
    }
  >();

  activeSessions.forEach((s) => {
    if (Number(s.violations || 0) > 0 || s.status === 'TERKUNCI_PELANGGARAN') {
      violatorMap.set(s.student_id, {
        student_id: s.student_id,
        student_name: s.student_name,
        student_identity: s.student_identity,
        student_class: s.student_class,
        exam_room: s.exam_room || 'Ruang 01',
        exam_title: s.exam_title || '-',
        violations: Number(s.violations || 0),
        last_reason: resolveViolationReason(s, cache.violationLogs),
      });
    }
  });

  violationRecords.forEach((v) => {
    if (!violatorMap.has(v.student_id)) {
      violatorMap.set(v.student_id, {
        student_id: v.student_id,
        student_name: v.student_name,
        student_identity: v.student_identity,
        student_class: v.student_class,
        exam_room: v.exam_room || 'Ruang 01',
        exam_title: v.exam_title || '-',
        violations: Number(v.violation_count || 1),
        last_reason: v.reason || 'Pelanggaran tata tertib',
      });
    }
  });

  const filteredViolators = Array.from(violatorMap.values()).filter((v) => {
    const q = violSearch.trim().toLowerCase();
    return !q || `${v.student_name} ${v.student_identity} ${v.student_class} ${v.exam_room} ${v.last_reason}`.toLowerCase().includes(q);
  });

  const bulkResetLogins = async () => {
    if (filteredLogins.length === 0) return;
    const ids = filteredLogins.map((s) => s.student_id);
    setLoading(true, `Mereset login ${ids.length} peserta...`);
    try {
      const sb = ensureSupabase();
      const { error } = await sb.from('cbt_active_sessions').delete().in('student_id', ids);
      if (error) throw error;
      ids.forEach((id) => onRemoveFromAlertQueue(id));
      await onSync();
      showToast(`${ids.length} sesi login berhasil direset!`, 'success');
    } catch (err) {
      showToast('Gagal reset login massal: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRetakeSingle = async (resultId: string, studentId: string, studentName: string, examTitle: string) => {
    setLoading(true, `Membuka akses ujian ulang untuk ${studentName}...`);
    try {
      const sb = ensureSupabase();
      const { error } = await sb.from('cbt_results').delete().eq('id', resultId);
      if (error) throw error;
      await sb.from('cbt_active_sessions').delete().eq('student_id', studentId);
      onRemoveFromAlertQueue(studentId);
      await onSync();
      showToast(`Berhasil! ${studentName} sekarang dapat mengulang ujian "${examTitle}".`, 'success');
    } catch (err) {
      showToast('Gagal membuka akses ujian ulang: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const bulkRetake = async () => {
    if (filteredResults.length === 0) return;
    const resIds = filteredResults.map((r) => r.id);
    const stdIds = [...new Set(filteredResults.map((r) => r.studentId))];
    setLoading(true, `Mereset ${filteredResults.length} hasil ujian...`);
    try {
      const sb = ensureSupabase();
      const { error } = await sb.from('cbt_results').delete().in('id', resIds);
      if (error) throw error;
      await sb.from('cbt_active_sessions').delete().in('student_id', stdIds);
      stdIds.forEach((id) => onRemoveFromAlertQueue(id));
      await onSync();
      showToast(`${filteredResults.length} peserta diizinkan mengikuti ujian ulang!`, 'success');
    } catch (err) {
      showToast('Gagal reset massal: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetViolationsSingle = async (studentId: string, studentName: string) => {
    setLoading(true, `Mereset pelanggaran ${studentName}...`);
    try {
      const sb = ensureSupabase();
      await sb.from('cbt_active_sessions').update({ violations: 0, status: 'SEDANG_UJIAN' }).eq('student_id', studentId);
      await sb.from('cbt_violation_logs').delete().eq('student_id', studentId);
      onRemoveFromAlertQueue(studentId);
      await onSync();
      showToast(`Pelanggaran ${studentName} berhasil direset menjadi 0!`, 'success');
    } catch (err) {
      showToast('Gagal: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const bulkResetViolations = async () => {
    if (filteredViolators.length === 0) return;
    const ids = filteredViolators.map((v) => v.student_id);
    setLoading(true, `Mereset pelanggaran ${ids.length} peserta...`);
    try {
      const sb = ensureSupabase();
      await sb.from('cbt_active_sessions').update({ violations: 0, status: 'SEDANG_UJIAN' }).in('student_id', ids);
      await sb.from('cbt_violation_logs').delete().in('student_id', ids);
      ids.forEach((id) => onRemoveFromAlertQueue(id));
      await onSync();
      showToast(`Pelanggaran ${ids.length} peserta berhasil direset menjadi 0!`, 'success');
    } catch (err) {
      showToast('Gagal: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-900 rounded-2xl p-6 text-white shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <span className="text-amber-300 text-xs font-extrabold uppercase tracking-wider inline-flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5" /> Pusat Kontrol Pemulihan Peserta
          </span>
          <h3 className="text-xl font-extrabold">Reset Login, Reset Ujian &amp; Reset Pelanggaran</h3>
          <p className="text-xs text-indigo-100 leading-relaxed">
            Pilih kategori reset di bawah ini untuk membuka kunci akun peserta, mengizinkan ujian ulang dari awal, atau membersihkan catatan pelanggaran tata tertib.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5 tabular-nums">
          <div className="px-3.5 py-2.5 rounded-2xl bg-rose-500/20 border border-rose-400/30 text-center">
            <p className="text-[10px] uppercase font-bold text-rose-200">Login Aktif / Terkunci</p>
            <p className="text-xl font-black text-white">
              {activeSessions.length} <span className="text-xs text-amber-300">({lockedCount} Kunci)</span>
            </p>
          </div>
          <div className="px-3.5 py-2.5 rounded-2xl bg-purple-500/20 border border-purple-400/30 text-center">
            <p className="text-[10px] uppercase font-bold text-purple-200">Selesai Ujian</p>
            <p className="text-xl font-black text-white">{results.length}</p>
          </div>
          <div className="px-3.5 py-2.5 rounded-2xl bg-amber-500/20 border border-amber-400/30 text-center">
            <p className="text-[10px] uppercase font-bold text-amber-200">Pelanggaran</p>
            <p className="text-xl font-black text-white">{violationRecords.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setSubTab('login')}
          className={`p-4 rounded-2xl border-2 text-left transition flex items-center justify-between gap-3 ${
            subTab === 'login' ? 'border-rose-600 bg-rose-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-rose-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                subTab === 'login' ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-600'
              }`}
            >
              <Unlock className="w-5 h-5" />
            </div>
            <div>
              <p className="font-extrabold text-slate-900 text-sm">1. Reset Login Peserta</p>
              <p className="text-[11px] text-slate-500">Buka kunci sesi masuk</p>
            </div>
          </div>
          <span className="font-black text-sm text-rose-700 tabular-nums">{activeSessions.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('exam')}
          className={`p-4 rounded-2xl border-2 text-left transition flex items-center justify-between gap-3 ${
            subTab === 'exam' ? 'border-purple-600 bg-purple-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-purple-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                subTab === 'exam' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-600'
              }`}
            >
              <Redo2 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-extrabold text-slate-900 text-sm">2. Reset Ujian (Ulang)</p>
              <p className="text-[11px] text-slate-500">Hapus hasil &amp; ulang dari awal</p>
            </div>
          </div>
          <span className="font-black text-sm text-purple-700 tabular-nums">{results.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('violation')}
          className={`p-4 rounded-2xl border-2 text-left transition flex items-center justify-between gap-3 ${
            subTab === 'violation' ? 'border-amber-500 bg-amber-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-amber-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                subTab === 'violation' ? 'bg-amber-500 text-slate-950' : 'bg-amber-100 text-amber-700'
              }`}
            >
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="font-extrabold text-slate-900 text-sm">3. Reset Pelanggaran</p>
              <p className="text-[11px] text-slate-500">Nolkan pelanggaran &amp; log</p>
            </div>
          </div>
          <span className="font-black text-sm text-amber-700 tabular-nums">{violationRecords.length}</span>
        </button>
      </div>

      {subTab === 'login' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-slate-800">Daftar Sesi Login Aktif &amp; Terkunci ({filteredLogins.length})</h4>
              <p className="text-xs text-slate-500">Buka kunci sesi masuk peserta agar dapat login ulang di perangkat baru.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={loginSearch}
                onChange={(e) => setLoginSearch(e.target.value)}
                placeholder="Cari nama / NISN / kelas..."
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold outline-none"
              />
              {!isRoomRestricted && (
                <select
                  value={loginRoom}
                  onChange={(e) => setLoginRoom(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                >
                  <option value="ALL">Semua Ruang</option>
                  {cache.rooms.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
              {filteredLogins.length > 0 && (
                <button
                  type="button"
                  onClick={bulkResetLogins}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs"
                >
                  Reset Login Massal
                </button>
              )}
            </div>
          </div>

          {filteredLogins.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">Tidak ada sesi login aktif atau terkunci saat ini.</div>
          ) : (
            <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="text-slate-500 text-xs uppercase border-b border-slate-200">
                    <th className="py-3 px-4">Peserta &amp; Kelas</th>
                    <th className="py-3 px-4">Ruang</th>
                    <th className="py-3 px-4">Status Sesi</th>
                    <th className="py-3 px-4">Ujian &amp; Progres</th>
                    <th className="py-3 px-4 text-center">Pelanggaran</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogins.map((s) => {
                    const isLocked = s.status === 'TERKUNCI_PELANGGARAN';
                    return (
                      <tr key={s.student_id} className={isLocked ? 'bg-rose-50/80' : 'hover:bg-slate-50'}>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-800">{s.student_name}</p>
                          <p className="text-xs text-slate-500 font-mono">
                            {s.student_identity} · <span className="font-bold text-indigo-700">{s.student_class}</span>
                          </p>
                        </td>
                        <td className="py-3 px-4 text-xs font-bold text-indigo-700">{s.exam_room || 'Ruang 01'}</td>
                        <td className="py-3 px-4">
                          {isLocked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-600 text-white text-xs font-extrabold">
                              <Lock className="w-3 h-3" /> Terkunci
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">{s.status}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <p className="font-bold text-slate-700">{s.exam_title || '-'}</p>
                          <p className="text-slate-400">{s.progress || '-'}</p>
                        </td>
                        <td className="py-3 px-4 text-center font-extrabold text-xs tabular-nums">{s.violations || 0}x</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => onResetLogin(s.student_id, s.student_name)}
                            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs inline-flex items-center gap-1.5"
                          >
                            <Unlock className="w-3.5 h-3.5" /> Reset Login
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subTab === 'exam' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-5">
                <input
                  type="text"
                  value={retakeSearch}
                  onChange={(e) => setRetakeSearch(e.target.value)}
                  placeholder="Cari nama siswa atau NISN..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold outline-none"
                />
              </div>
              <div className="sm:col-span-4">
                <select
                  value={retakeExam}
                  onChange={(e) => setRetakeExam(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                >
                  <option value="ALL">Semua Jadwal Ujian ({results.length})</option>
                  {cache.exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title} ({ex.subject})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <select
                  value={retakeClass}
                  onChange={(e) => setRetakeClass(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                >
                  <option value="ALL">Semua Kelas</option>
                  {cache.classes.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-extrabold text-purple-700 tabular-nums">Menampilkan {filteredResults.length} Data</span>
              {filteredResults.length > 0 && (
                <button
                  type="button"
                  onClick={bulkRetake}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                >
                  <Redo2 className="w-3.5 h-3.5" /> Reset Ujian Massal (Terfilter)
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {filteredResults.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm">Belum ada riwayat ujian selesai yang perlu direset.</div>
            ) : (
              <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="text-slate-500 text-xs uppercase border-b border-slate-200">
                      <th className="py-3 px-4">Peserta &amp; Kelas</th>
                      <th className="py-3 px-4">Mata Pelajaran &amp; Ujian</th>
                      <th className="py-3 px-4 text-center">Nilai Lama</th>
                      <th className="py-3 px-4 text-center">Pelanggaran</th>
                      <th className="py-3 px-4">Waktu Selesai</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredResults.map((r) => (
                      <tr key={r.id} className="hover:bg-purple-50/40">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-800">{r.studentName}</p>
                          <p className="text-xs text-slate-500 font-mono">
                            {r.studentIdentity} · <span className="font-bold text-indigo-700">{r.studentClass}</span>
                          </p>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <p className="font-bold text-slate-800">{r.examTitle}</p>
                          <span className="text-slate-500">{r.subject}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-black tabular-nums">{r.score}</td>
                        <td className="py-3 px-4 text-center text-xs font-bold tabular-nums">{r.violations || 0}x</td>
                        <td className="py-3 px-4 text-xs text-slate-500">{formatDateTimeIndo(r.submittedAt)}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleRetakeSingle(r.id, r.studentId, r.studentName, r.examTitle)}
                            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs inline-flex items-center gap-1.5"
                          >
                            <Redo2 className="w-3.5 h-3.5" /> Reset Ujian
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'violation' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-slate-800">Daftar Peserta dengan Catatan Pelanggaran ({filteredViolators.length})</h4>
              <p className="text-xs text-slate-500">Reset hitungan pelanggaran menjadi 0x dan hapus log pelanggaran peserta.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={violSearch}
                onChange={(e) => setViolSearch(e.target.value)}
                placeholder="Cari nama / NISN / kelas..."
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold outline-none"
              />
              {filteredViolators.length > 0 && (
                <button
                  type="button"
                  onClick={bulkResetViolations}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs"
                >
                  Reset Semua Pelanggaran
                </button>
              )}
            </div>
          </div>

          {filteredViolators.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">Tidak ada peserta dengan catatan pelanggaran saat ini.</div>
          ) : (
            <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="text-slate-500 text-xs uppercase border-b border-slate-200">
                    <th className="py-3 px-4">Peserta &amp; Kelas</th>
                    <th className="py-3 px-4">Ruang</th>
                    <th className="py-3 px-4">Ujian &amp; Alasan Terakhir</th>
                    <th className="py-3 px-4 text-center">Jumlah</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredViolators.map((v) => (
                    <tr key={v.student_id} className="hover:bg-amber-50/40">
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-800">{v.student_name}</p>
                        <p className="text-xs text-slate-500 font-mono">
                          {v.student_identity} · <span className="font-bold text-indigo-700">{v.student_class}</span>
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs font-bold text-indigo-700">{v.exam_room}</td>
                      <td className="py-3 px-4 text-xs">
                        <p className="font-bold text-slate-700">{v.exam_title}</p>
                        <p className="text-rose-700 font-semibold">{v.last_reason}</p>
                      </td>
                      <td className="py-3 px-4 text-center font-extrabold text-rose-700 tabular-nums">{v.violations}x</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleResetViolationsSingle(v.student_id, v.student_name)}
                          className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs inline-flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Reset Pelanggaran
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
