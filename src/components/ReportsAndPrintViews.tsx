import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Megaphone,
  PenLine,
  Printer,
  RotateCcw,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { ensureSupabase } from '../lib/supabase';
import {
  formatDateTimeIndo,
  getOfficialSubjectNames,
  getUnifiedViolationRecords,
  isSubjectAllowedForUser,
} from '../lib/utils';
import type {
  Announcement,
  AppCache,
  ExamResult,
  ToastItem,
  UserSession,
} from '../types/cbt';
import { MathText } from './MathText';

// 1. KARTU PESERTA UJIAN
interface ParticipantCardsViewProps {
  cache: AppCache;
}

export const ParticipantCardsView: React.FC<ParticipantCardsViewProps> = ({ cache }) => {
  const [filterClass, setFilterClass] = useState('ALL');
  const [filterRoom, setFilterRoom] = useState('ALL');
  const s = cache.schoolSettings;

  const list = cache.students.filter(
    (st) =>
      (filterClass === 'ALL' || st.kelas === filterClass) &&
      (filterRoom === 'ALL' || st.exam_room === filterRoom)
  );

  return (
    <div className="space-y-6 fade-in">
      <div className="no-print bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold outline-none focus:border-indigo-500"
          >
            <option value="ALL">Semua Kelas ({cache.students.length} Siswa)</option>
            {cache.classes.map((c) => (
              <option key={c.id} value={c.name}>
                Kelas {c.name}
              </option>
            ))}
          </select>
          <select
            value={filterRoom}
            onChange={(e) => setFilterRoom(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold outline-none focus:border-indigo-500"
          >
            <option value="ALL">Semua Ruang</option>
            {cache.rooms.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow transition inline-flex items-center gap-2"
        >
          <Printer className="w-4 h-4" /> Cetak Semua Kartu ({list.length})
        </button>
      </div>

      <div id="print-area-container" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.length === 0 ? (
          <div className="col-span-full bg-white p-10 text-center text-slate-400 rounded-2xl border border-slate-200">
            Tidak ada peserta pada filter ini.
          </div>
        ) : (
          list.map((st, idx) => (
            <div
              key={st.id}
              className="bg-white border-2 border-slate-800 rounded-xl p-4 break-inside-avoid shadow-sm"
            >
              <div className="flex items-center gap-3 border-b-2 border-slate-800 pb-2.5 mb-3">
                {s.logo_url ? (
                  <img
                    src={s.logo_url}
                    alt="Logo"
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 object-contain shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 bg-slate-900 text-white rounded flex items-center justify-center font-black text-xs shrink-0">
                    CBT
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase text-slate-600 truncate">
                    {s.education_office}
                  </p>
                  <p className="text-xs font-black text-slate-900 uppercase truncate">
                    KARTU PESERTA UJIAN · {s.school_name}
                  </p>
                  <p className="text-[9px] text-slate-500">
                    TA {s.academic_year} · Semester {s.semester}
                  </p>
                </div>
              </div>
              <table className="w-full text-[11px] mb-2">
                <tbody>
                  <tr>
                    <td className="py-0.5 text-slate-500 w-24">No. Peserta</td>
                    <td className="py-0.5 font-mono font-bold text-slate-900 tabular-nums">
                      : {String(idx + 1).padStart(4, '0')}-{st.nisn}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-slate-500">Nama Lengkap</td>
                    <td className="py-0.5 font-black text-slate-900 uppercase">: {st.name}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-slate-500">Kelas / Ruang</td>
                    <td className="py-0.5 font-bold text-slate-800">
                      : {st.kelas} · {st.exam_room} ({st.exam_session})
                    </td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-slate-500">Username CBT</td>
                    <td className="py-0.5 font-mono font-bold text-indigo-700">: {st.username}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-slate-500">Password CBT</td>
                    <td className="py-0.5 font-mono font-bold text-rose-600">: {st.password}</td>
                  </tr>
                </tbody>
              </table>
              <div className="flex justify-between items-end pt-2 border-t border-slate-200 text-[9px] text-slate-500">
                <span>Harap dibawa saat mengikuti ujian</span>
                <div className="text-right">
                  <p>{s.city}, Panitia CBT</p>
                  <p className="font-bold text-slate-800 mt-3">{s.committee_head}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// 2. DENAH DUDUK RUANGAN
interface SeatingPlanViewProps {
  cache: AppCache;
}

export const SeatingPlanView: React.FC<SeatingPlanViewProps> = ({ cache }) => {
  const [selectedRoom, setSelectedRoom] = useState(cache.rooms[0]?.name || 'Ruang 01');
  const [selectedSession, setSelectedSession] = useState('ALL');
  const s = cache.schoolSettings;

  const list = cache.students.filter(
    (st) =>
      st.exam_room === selectedRoom &&
      (selectedSession === 'ALL' || st.exam_session === selectedSession)
  );

  return (
    <div className="space-y-6 fade-in">
      <div className="no-print bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-bold outline-none focus:border-indigo-500"
          >
            {cache.rooms.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name} ({r.location})
              </option>
            ))}
          </select>
          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold outline-none focus:border-indigo-500"
          >
            <option value="ALL">Semua Sesi</option>
            {cache.sessions.map((ses) => (
              <option key={ses.id} value={ses.name}>
                {ses.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow transition inline-flex items-center gap-2"
        >
          <Printer className="w-4 h-4" /> Cetak Denah Duduk
        </button>
      </div>

      <div id="print-area-container" className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
          <p className="text-xs font-bold uppercase text-slate-600">{s.education_office}</p>
          <h3 className="text-lg font-black uppercase text-slate-900">
            DENAH TEMPAT DUDUK PESERTA UJIAN · {s.school_name}
          </h3>
          <p className="text-xs font-bold text-indigo-700 mt-1">
            {selectedRoom} · {selectedSession === 'ALL' ? 'Semua Sesi' : selectedSession} · Total: {list.length} Peserta
          </p>
        </div>
        <div className="w-64 mx-auto mb-6 py-2 bg-slate-800 text-white text-center text-xs font-bold rounded-lg uppercase tracking-wider">
          MEJA PENGAWAS UJIAN / PROKTOR
        </div>
        {list.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-8">
            Belum ada peserta yang ditempatkan di ruangan dan sesi ini.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {list.map((st, idx) => (
              <div
                key={st.id}
                className="border-2 border-slate-700 rounded-xl p-3 text-center bg-slate-50"
              >
                <span className="inline-block px-2 py-0.5 bg-slate-900 text-white text-[10px] font-black rounded mb-1.5 tabular-nums">
                  KURSI {String(idx + 1).padStart(2, '0')}
                </span>
                <p className="text-xs font-black text-slate-900 leading-tight">{st.name}</p>
                <p className="text-[10px] text-slate-600 font-mono mt-0.5 tabular-nums">
                  {st.nisn} · {st.kelas}
                </p>
                <p className="text-[10px] text-indigo-700 font-bold mt-0.5">{st.exam_session}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// 3. LOG PELANGGARAN PESERTA
interface ViolationsLogViewProps {
  cache: AppCache;
  currentUser: UserSession;
  onSync: () => Promise<void>;
  setLoading: (val: boolean, text?: string) => void;
  showToast: (msg: string, type?: ToastItem['type']) => void;
}

export const ViolationsLogView: React.FC<ViolationsLogViewProps> = ({
  cache,
  currentUser,
  onSync,
  setLoading,
  showToast,
}) => {
  const [search, setSearch] = useState('');
  const logs = getUnifiedViolationRecords(cache).filter((v) => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      `${v.student_name} ${v.student_class} ${v.exam_room} ${v.exam_title} ${v.reason}`
        .toLowerCase()
        .includes(q)
    );
  });

  const handleClearLogs = async () => {
    if (!window.confirm('Bersihkan seluruh riwayat log pelanggaran?')) return;
    setLoading(true, 'Menghapus log pelanggaran...');
    try {
      const sb = ensureSupabase();
      const { error } = await sb.from('cbt_violation_logs').delete().neq('id', '_never_');
      if (error) throw error;
      showToast('Seluruh riwayat pelanggaran berhasil dibersihkan!', 'success');
      await onSync();
    } catch (err) {
      showToast('Gagal menghapus log: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Log Pelanggaran Tata Tertib Ujian</h3>
            <p className="text-xs text-slate-500">
              Catatan otomatis keluar layar penuh, berpindah tab, atau aktivitas terlarang ({logs.length} rekaman)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama/ruang/alasan..."
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-indigo-500"
          />
          {currentUser.role === 'admin' && logs.length > 0 && (
            <button
              type="button"
              onClick={handleClearLogs}
              className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Bersihkan Log
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">Siswa &amp; Kelas</th>
                <th className="py-3 px-4">Ruang</th>
                <th className="py-3 px-4">Ujian</th>
                <th className="py-3 px-4">Alasan Pelanggaran</th>
                <th className="py-3 px-4 text-center">Ke-</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Tidak ada catatan pelanggaran tata tertib.
                  </td>
                </tr>
              ) : (
                logs.map((v) => (
                  <tr key={v.id} className="hover:bg-rose-50/40">
                    <td className="py-3 px-4 text-slate-500 tabular-nums whitespace-nowrap">
                      {formatDateTimeIndo(v.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-800">{v.student_name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {v.student_identity} · {v.student_class}
                      </p>
                    </td>
                    <td className="py-3 px-4 font-bold text-indigo-700">{v.exam_room || '-'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{v.exam_title}</td>
                    <td className="py-3 px-4 text-rose-700 font-semibold">{v.reason}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-black tabular-nums">
                        {v.violation_count}x
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// 4. PAPAN PENGUMUMAN & TATA TERTIB
interface AnnouncementsViewProps {
  cache: AppCache;
  currentUser: UserSession;
  onSync: () => Promise<void>;
  onDeleteRecord: (table: string, id: string) => void;
  setLoading: (val: boolean, text?: string) => void;
  showToast: (msg: string, type?: ToastItem['type']) => void;
}

export const AnnouncementsView: React.FC<AnnouncementsViewProps> = ({
  cache,
  currentUser,
  onSync,
  onDeleteRecord,
  setLoading,
  showToast,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('TATA TERTIB');
  const [targetRole, setTargetRole] = useState('semua');
  const [content, setContent] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      showToast('Isi judul dan isi pengumuman!', 'warning');
      return;
    }
    setLoading(true, 'Menyimpan pengumuman...');
    try {
      const sb = ensureSupabase();
      const payload: Announcement = {
        id: 'ann_' + Date.now(),
        title: title.trim(),
        category,
        content: content.trim(),
        target_role: targetRole,
        is_active: true,
        created_by: currentUser.name,
        created_at: new Date().toISOString(),
      };
      const { error } = await sb.from('cbt_announcements').insert(payload);
      if (error) throw error;
      showToast('Pengumuman dipublikasikan!', 'success');
      setTitle('');
      setContent('');
      await onSync();
    } catch (err) {
      showToast('Gagal menyimpan pengumuman: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 fade-in">
      <form
        onSubmit={handleSave}
        className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit"
      >
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-indigo-600" /> Buat Pengumuman / Tata Tertib
        </h3>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Judul</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Contoh: Tata Tertib Ujian CBT"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-indigo-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Kategori</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm outline-none"
            >
              <option value="TATA TERTIB">TATA TERTIB</option>
              <option value="PENTING">PENTING</option>
              <option value="INFO">INFO</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Sasaran</label>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm outline-none"
            >
              <option value="semua">Semua Pengguna</option>
              <option value="siswa">Siswa</option>
              <option value="guru">Guru &amp; Pengawas</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Isi Pengumuman</label>
          <textarea
            rows={5}
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tuliskan poin pengumuman atau aturan ujian..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-indigo-500"
          />
        </div>
        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition"
        >
          Terbitkan Pengumuman
        </button>
      </form>

      <div className="lg:col-span-2 space-y-3">
        {cache.announcements.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
            Belum ada pengumuman yang diterbitkan.
          </div>
        ) : (
          cache.announcements.map((a) => (
            <div
              key={a.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-start gap-4"
            >
              <div>
                <div className="flex items-center gap-2 text-xs mb-1">
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold">
                    {a.category}
                  </span>
                  <span className="text-slate-400">
                    Sasaran: {a.target_role} · {formatDateTimeIndo(a.created_at)}
                  </span>
                </div>
                <h4 className="font-bold text-slate-800 text-base">{a.title}</h4>
                <p className="text-sm text-slate-600 whitespace-pre-wrap mt-1">{a.content}</p>
              </div>
              <button
                type="button"
                onClick={() => onDeleteRecord('cbt_announcements', a.id)}
                className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 shrink-0"
                title="Hapus Pengumuman"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// 5. HASIL UJIAN & CETAK BERITA ACARA
interface ResultsAndBeritaAcaraViewProps {
  cache: AppCache;
  currentUser: UserSession;
  onSync: () => Promise<void>;
  onDeleteRecord: (table: string, id: string) => void;
  onPrintDedicated: (htmlNode: React.ReactNode) => void;
  showToast: (msg: string, type?: ToastItem['type']) => void;
}

export const ResultsAndBeritaAcaraView: React.FC<ResultsAndBeritaAcaraViewProps> = ({
  cache,
  currentUser,
  onDeleteRecord,
  onPrintDedicated,
  showToast,
}) => {
  const [filterExam, setFilterExam] = useState('ALL');
  const [filterClass, setFilterClass] = useState('ALL');
  const [search, setSearch] = useState('');
  const [baModalOpen, setBaModalOpen] = useState(false);
  const [baExamId, setBaExamId] = useState(cache.exams[0]?.id || '');
  const [baRoom, setBaRoom] = useState(cache.rooms[0]?.name || 'Ruang 01');
  const [baProctorName, setBaProctorName] = useState(currentUser.name);
  const [baProctorNip, setBaProctorNip] = useState(currentUser.identity || '-');
  const [baNotes, setBaNotes] = useState('Ujian berjalan dengan tertib, aman, dan lancar tanpa kendala teknis yang berarti.');

  const allowedResults = useMemo(() => {
    return cache.results
      .filter((r) => currentUser.role !== 'guru' || isSubjectAllowedForUser(currentUser, r.subject))
      .filter((r) => filterExam === 'ALL' || r.examId === filterExam)
      .filter((r) => filterClass === 'ALL' || r.studentClass === filterClass)
      .filter((r) => {
        const q = search.trim().toLowerCase();
        return !q || `${r.studentName} ${r.studentIdentity} ${r.examTitle}`.toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
  }, [cache.results, currentUser, filterExam, filterClass, search]);

  const handleExportCsv = () => {
    const header = ['Nama Siswa', 'NISN', 'Kelas', 'Ujian', 'Mata Pelajaran', 'Benar', 'Total Soal', 'Nilai Akhir', 'Pelanggaran', 'Waktu Kumpul'];
    const rows = allowedResults.map((r) => [
      `"${r.studentName}"`,
      `"${r.studentIdentity}"`,
      `"${r.studentClass}"`,
      `"${r.examTitle}"`,
      `"${r.subject}"`,
      r.correctCount,
      r.totalQuestions,
      r.score,
      r.violations,
      `"${formatDateTimeIndo(r.submittedAt)}"`,
    ]);
    const csv = [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rekap_Nilai_CBT_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Rekap nilai berhasil diekspor ke CSV.', 'success');
  };

  const triggerPrintBeritaAcara = () => {
    const exam = cache.exams.find((e) => e.id === baExamId) || cache.exams[0];
    const s = cache.schoolSettings;
    const roomStudents = cache.students.filter((st) => st.exam_room === baRoom);
    const examResults = cache.results.filter((r) => !exam || r.examId === exam.id);
    const presentCount = roomStudents.filter((st) =>
      examResults.some((r) => r.studentId === st.id)
    ).length;
    const absentCount = Math.max(0, roomStudents.length - presentCount);
    const todayStr = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    onPrintDedicated(
      <div className="p-8 bg-white text-slate-900 text-sm leading-relaxed max-w-3xl mx-auto">
        <div className="flex items-center gap-4 border-b-4 border-double border-slate-900 pb-4 mb-6">
          {s.logo_url && (
            <img src={s.logo_url} alt="Logo" className="w-16 h-16 object-contain" />
          )}
          <div className="text-center flex-1">
            <p className="text-xs font-bold uppercase">{s.education_office}</p>
            <h2 className="text-xl font-black uppercase">{s.school_name}</h2>
            <p className="text-xs">{s.address} · NPSN: {s.npsn}</p>
          </div>
        </div>

        <div className="text-center mb-6">
          <h3 className="text-base font-black uppercase underline">
            BERITA ACARA PELAKSANAAN UJIAN BERBASIS KOMPUTER (CBT)
          </h3>
          <p className="text-xs mt-1">
            Tahun Pelajaran {s.academic_year} · Semester {s.semester}
          </p>
        </div>

        <p className="mb-4 text-justify">
          Pada hari ini <strong>{todayStr}</strong>, telah dilaksanakan Ujian Berbasis Komputer (CBT) di{' '}
          <strong>{s.school_name}</strong> dengan rincian sebagai berikut:
        </p>

        <table className="w-full border-collapse border border-slate-800 text-xs mb-5">
          <tbody>
            <tr>
              <td className="border border-slate-800 p-2 font-bold w-48">Nama Jadwal Ujian</td>
              <td className="border border-slate-800 p-2">{exam ? exam.title : '-'}</td>
            </tr>
            <tr>
              <td className="border border-slate-800 p-2 font-bold">Mata Pelajaran</td>
              <td className="border border-slate-800 p-2">{exam ? exam.subject : '-'}</td>
            </tr>
            <tr>
              <td className="border border-slate-800 p-2 font-bold">Ruang Ujian</td>
              <td className="border border-slate-800 p-2">{baRoom}</td>
            </tr>
            <tr>
              <td className="border border-slate-800 p-2 font-bold">Peserta Terdaftar / Hadir / Tidak Hadir</td>
              <td className="border border-slate-800 p-2">
                {roomStudents.length} Peserta · Hadir: {presentCount} · Tidak Hadir: {absentCount}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-800 p-2 font-bold">Catatan Kejadian Khusus</td>
              <td className="border border-slate-800 p-2">{baNotes}</td>
            </tr>
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-8 mt-10 text-xs">
          <div className="text-center">
            <p>Mengetahui,</p>
            <p className="font-bold">Kepala Sekolah / Ketua Panitia</p>
            <div className="h-16" />
            <p className="font-bold underline">{s.principal_name}</p>
            <p>{s.principal_nip}</p>
          </div>
          <div className="text-center">
            <p>{s.city}, {todayStr}</p>
            <p className="font-bold">Pengawas Ruang Ujian</p>
            <div className="h-16" />
            <p className="font-bold underline">{baProctorName}</p>
            <p>{baProctorNip}</p>
          </div>
        </div>
      </div>
    );
    setBaModalOpen(false);
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-3">
        <div className="flex flex-wrap gap-2.5 items-center">
          <select
            value={filterExam}
            onChange={(e) => setFilterExam(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
          >
            <option value="ALL">Semua Jadwal Ujian</option>
            {cache.exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title} ({ex.subject})
              </option>
            ))}
          </select>
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
          >
            <option value="ALL">Semua Kelas</option>
            {cache.classes.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama/NISN..."
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setBaModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs inline-flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> Cetak Berita Acara
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Ekspor CSV ({allowedResults.length})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                <th className="py-3 px-4">Siswa &amp; Kelas</th>
                <th className="py-3 px-4">Ujian &amp; Mapel</th>
                <th className="py-3 px-4 text-center">Benar / Soal</th>
                <th className="py-3 px-4 text-center">Nilai Akhir</th>
                <th className="py-3 px-4 text-center">Status Koreksi</th>
                <th className="py-3 px-4">Dikumpulkan</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {allowedResults.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Belum ada hasil ujian yang masuk.
                  </td>
                </tr>
              ) : (
                allowedResults.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-800">{r.studentName}</p>
                      <p className="text-xs text-slate-500 font-mono">
                        {r.studentIdentity} · {r.studentClass}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800">{r.examTitle}</p>
                      <p className="text-xs text-indigo-600 font-semibold">{r.subject}</p>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-xs tabular-nums">
                      {r.correctCount} / {r.totalQuestions}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-3 py-1 rounded-xl font-black text-sm tabular-nums ${
                          r.score >= 75
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {r.score}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-xs">
                      {r.gradingStatus === 'pending_essay' ? (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                          Menunggu Esai
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                          Selesai
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 tabular-nums">
                      {formatDateTimeIndo(r.submittedAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteRecord('cbt_results', r.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold inline-flex items-center gap-1"
                        title="Hapus Hasil / Izinkan Ujian Ulang"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {baModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 fade-in space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" /> Cetak Berita Acara Resmi
              </h3>
              <button type="button" onClick={() => setBaModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Pilih Jadwal Ujian</label>
                <select
                  value={baExamId}
                  onChange={(e) => setBaExamId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none"
                >
                  {cache.exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title} ({ex.subject})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Ruang Ujian</label>
                <select
                  value={baRoom}
                  onChange={(e) => setBaRoom(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none"
                >
                  {cache.rooms.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nama Pengawas</label>
                  <input
                    type="text"
                    value={baProctorName}
                    onChange={(e) => setBaProctorName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">NIP Pengawas</label>
                  <input
                    type="text"
                    value={baProctorNip}
                    onChange={(e) => setBaProctorNip(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Catatan Kejadian Khusus</label>
                <textarea
                  rows={3}
                  value={baNotes}
                  onChange={(e) => setBaNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBaModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={triggerPrintBeritaAcara}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 inline-flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Cetak Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 6. ANALISIS KETUNTASAN KKTP
interface KktpAnalysisViewProps {
  cache: AppCache;
}

export const KktpAnalysisView: React.FC<KktpAnalysisViewProps> = ({ cache }) => {
  const subjects = getOfficialSubjectNames(cache);

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
          <BarChart3 className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-slate-800">Analisis Ketuntasan KKTP Per Mata Pelajaran</h3>
          <p className="text-xs text-slate-500">
            Persentase kelulusan peserta terhadap Kriteria Ketercapaian Tujuan Pembelajaran (KKTP)
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                <th className="py-3 px-4">Mata Pelajaran</th>
                <th className="py-3 px-4 text-center">KKTP</th>
                <th className="py-3 px-4 text-center">Peserta Dinilai</th>
                <th className="py-3 px-4 text-center">Rata-Rata</th>
                <th className="py-3 px-4 text-center">Tuntas</th>
                <th className="py-3 px-4 text-center">Persentase Tuntas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {subjects.map((subName) => {
                const subObj = cache.subjects.find((s) => s.name === subName);
                const kktp = subObj?.kktp || 75;
                const res = cache.results.filter((r) => r.subject === subName);
                const avg =
                  res.length > 0
                    ? (res.reduce((acc, r) => acc + Number(r.score || 0), 0) / res.length).toFixed(1)
                    : '0.0';
                const passed = res.filter((r) => Number(r.score || 0) >= kktp).length;
                const pct = res.length > 0 ? Math.round((passed / res.length) * 100) : 0;

                return (
                  <tr key={subName} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-bold text-slate-800">{subName}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-indigo-700 tabular-nums">
                      {kktp}
                    </td>
                    <td className="py-3.5 px-4 text-center tabular-nums">{res.length}</td>
                    <td className="py-3.5 px-4 text-center font-bold tabular-nums">{avg}</td>
                    <td className="py-3.5 px-4 text-center text-emerald-700 font-bold tabular-nums">
                      {passed}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-extrabold tabular-nums ${
                          pct >= 75
                            ? 'bg-emerald-100 text-emerald-700'
                            : pct >= 50
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// 7. KOREKSI SOAL ESAI MANUAL
interface EssayGradingViewProps {
  cache: AppCache;
  currentUser: UserSession;
  onSync: () => Promise<void>;
  setLoading: (val: boolean, text?: string) => void;
  showToast: (msg: string, type?: ToastItem['type']) => void;
}

export const EssayGradingView: React.FC<EssayGradingViewProps> = ({
  cache,
  currentUser,
  onSync,
  setLoading,
  showToast,
}) => {
  const [selectedResult, setSelectedResult] = useState<ExamResult | null>(null);
  const [overrideScore, setOverrideScore] = useState<number>(0);

  const allowedResults = cache.results.filter(
    (r) => currentUser.role !== 'guru' || isSubjectAllowedForUser(currentUser, r.subject)
  );
  const pendingList = allowedResults.filter((r) => r.gradingStatus === 'pending_essay');
  const displayList = pendingList.length > 0 ? pendingList : allowedResults;

  const openModal = (r: ExamResult) => {
    setSelectedResult(r);
    setOverrideScore(r.score);
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResult) return;
    setLoading(true, 'Menyimpan nilai hasil koreksi...');
    try {
      const sb = ensureSupabase();
      const { error } = await sb
        .from('cbt_results')
        .update({
          score: Number(overrideScore),
          grading_status: 'graded',
        })
        .eq('id', selectedResult.id);
      if (error) throw error;
      showToast(`Nilai akhir ${selectedResult.studentName} berhasil disimpan (${overrideScore})!`, 'success');
      setSelectedResult(null);
      await onSync();
    } catch (err) {
      showToast('Gagal menyimpan nilai: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const essayQuestions = useMemo(() => {
    if (!selectedResult) return [];
    return cache.questions.filter(
      (q) => q.subject === selectedResult.subject && q.type === 'esai'
    );
  }, [cache.questions, selectedResult]);

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Koreksi Jawaban Esai &amp; Penyesuaian Nilai</h3>
            <p className="text-xs text-slate-500">
              {pendingList.length} lembar jawaban menunggu koreksi esai manual
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                <th className="py-3 px-4">Siswa &amp; Kelas</th>
                <th className="py-3 px-4">Ujian &amp; Mapel</th>
                <th className="py-3 px-4 text-center">Nilai Saat Ini</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {displayList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    Belum ada jawaban peserta untuk dikoreksi.
                  </td>
                </tr>
              ) : (
                displayList.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-800">{r.studentName}</p>
                      <p className="text-xs text-slate-500">{r.studentClass}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800">{r.examTitle}</p>
                      <p className="text-xs text-indigo-600">{r.subject}</p>
                    </td>
                    <td className="py-3 px-4 text-center font-black tabular-nums">{r.score}</td>
                    <td className="py-3 px-4 text-center text-xs">
                      {r.gradingStatus === 'pending_essay' ? (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                          Perlu Koreksi
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Selesai
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openModal(r)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <PenLine className="w-3.5 h-3.5" /> Periksa Jawaban
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveGrade}
            className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4 fade-in"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" /> Lembar Koreksi: {selectedResult.studentName}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedResult.examTitle} · {selectedResult.subject}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedResult(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {essayQuestions.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 text-xs text-slate-600">
                  Jawaban terekam JSON:{' '}
                  <pre className="mt-2 font-mono text-[11px] whitespace-pre-wrap">
                    {JSON.stringify(selectedResult.answersDetail, null, 2)}
                  </pre>
                </div>
              ) : (
                essayQuestions.map((q, idx) => {
                  const studentAns = selectedResult.answersDetail?.[q.id];
                  return (
                    <div key={q.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                      <p className="text-xs font-bold text-indigo-700">Soal Esai #{idx + 1} (Bobot {q.questionWeight})</p>
                      <div className="text-sm text-slate-800">
                        <MathText text={q.question} />
                      </div>
                      <div className="p-3 rounded-lg bg-white border border-slate-200">
                        <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">Jawaban Siswa:</p>
                        <p className="text-sm text-slate-900 whitespace-pre-wrap">
                          {studentAns !== undefined && studentAns !== null && String(studentAns).trim() !== ''
                            ? String(studentAns)
                            : '(Tidak dijawab)'}
                        </p>
                      </div>
                      {q.answer ? (
                        <p className="text-xs text-emerald-700 font-semibold">
                          Referensi Kunci: {String(q.answer)}
                        </p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <label className="block text-xs font-bold text-indigo-900 mb-1">
                  Nilai Akhir Baru (0 - 100)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  required
                  value={overrideScore}
                  onChange={(e) => setOverrideScore(Number(e.target.value))}
                  className="w-36 px-3.5 py-2 rounded-xl border border-indigo-300 bg-white font-black text-indigo-900 text-lg tabular-nums outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedResult(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold inline-flex items-center gap-1.5 shadow"
                >
                  <UserCheck className="w-4 h-4" /> Simpan &amp; Finalisasi Nilai
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
