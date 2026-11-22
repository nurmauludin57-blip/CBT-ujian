import React, { useState } from 'react';
import {
  CalendarPlus,
  CheckCircle2,
  Edit3,
  KeyRound,
  Save,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import { ensureSupabase } from '../lib/supabase';
import {
  formatDateTimeIndo,
  generateRandomToken,
  getOfficialSubjectNames,
  toLocalDatetimeInputValue,
} from '../lib/utils';
import type { AppCache, ExamSchedule, ToastItem, UserSession } from '../types/cbt';

interface ExamScheduleManagerProps {
  cache: AppCache;
  currentUser: UserSession;
  onSync: () => Promise<void>;
  onDeleteRecord: (table: string, id: string) => void;
  setLoading: (val: boolean, text?: string) => void;
  showToast: (msg: string, type?: ToastItem['type']) => void;
}

export const ExamScheduleManager: React.FC<ExamScheduleManagerProps> = ({
  cache,
  currentUser,
  onSync,
  onDeleteRecord,
  setLoading,
  showToast,
}) => {
  const subjects = getOfficialSubjectNames(cache);
  const classes = cache.classes.map((c) => c.name);
  const sessions = cache.sessions.map((s) => s.name);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(subjects[0] || '');
  const [packetCode, setPacketCode] = useState('SEMUA');
  const [allClasses, setAllClasses] = useState(true);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [targetSession, setTargetSession] = useState('SEMUA');
  const [duration, setDuration] = useState(60);
  const [maxQuestions, setMaxQuestions] = useState(0);
  const [token, setToken] = useState(() => generateRandomToken());
  const [maxViolations, setMaxViolations] = useState(3);
  const [examMode, setExamMode] = useState<'strict' | 'relaxed'>('strict');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [sourceType, setSourceType] = useState<'internal' | 'gform'>('internal');
  const [gformUrl, setGformUrl] = useState('');
  const [randomize, setRandomize] = useState(true);
  const [randomizeOptions, setRandomizeOptions] = useState(true);
  const [requireProctorPin, setRequireProctorPin] = useState(false);
  const [showResult, setShowResult] = useState(true);

  const [classModalExam, setClassModalExam] = useState<ExamSchedule | null>(null);
  const [modalAllClasses, setModalAllClasses] = useState(true);
  const [modalSelectedClasses, setModalSelectedClasses] = useState<string[]>([]);

  const matchedQuestionsCount = cache.questions.filter((q) => {
    const sameSub = q.subject.trim().toLowerCase() === subject.trim().toLowerCase();
    const pkt = (packetCode || 'SEMUA').trim().toUpperCase();
    const samePkt = pkt === 'SEMUA' || q.packetCode.trim().toUpperCase() === pkt;
    return sameSub && samePkt;
  }).length;

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setSubject(subjects[0] || '');
    setPacketCode('SEMUA');
    setAllClasses(true);
    setSelectedClasses([]);
    setTargetSession('SEMUA');
    setDuration(60);
    setMaxQuestions(0);
    setToken(generateRandomToken());
    setMaxViolations(3);
    setExamMode('strict');
    setStartTime('');
    setEndTime('');
    setSourceType('internal');
    setGformUrl('');
    setRandomize(true);
    setRandomizeOptions(true);
    setRequireProctorPin(false);
    setShowResult(true);
  };

  const handleEdit = (exam: ExamSchedule) => {
    setEditingId(exam.id);
    setTitle(exam.title);
    setSubject(exam.subject);
    setPacketCode(exam.packetCode || 'SEMUA');
    const rawCls = String(exam.targetClass || 'SEMUA').trim();
    const isAll = rawCls.toUpperCase() === 'SEMUA';
    setAllClasses(isAll);
    setSelectedClasses(
      isAll
        ? []
        : rawCls
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean)
    );
    setTargetSession(exam.targetSession || 'SEMUA');
    setDuration(exam.duration || 60);
    setMaxQuestions(exam.maxQuestions || 0);
    setToken(exam.token || generateRandomToken());
    setMaxViolations(exam.maxViolations ?? 3);
    setExamMode(exam.examMode || 'strict');
    setStartTime(toLocalDatetimeInputValue(exam.startTime));
    setEndTime(toLocalDatetimeInputValue(exam.endTime));
    setSourceType(exam.sourceType || 'internal');
    setGformUrl(exam.gformUrl || '');
    setRandomize(Boolean(exam.randomize));
    setRandomizeOptions(exam.randomizeOptions !== false);
    setRequireProctorPin(Boolean(exam.requireProctorPin));
    setShowResult(exam.showResult !== false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allClasses && selectedClasses.length === 0) {
      showToast('Pilih minimal satu target kelas atau centang SEMUA KELAS!', 'warning');
      return;
    }
    if (sourceType === 'gform' && !gformUrl.trim()) {
      showToast('Masukkan URL Google Form terlebih dahulu!', 'warning');
      return;
    }
    const startIso = startTime ? new Date(startTime).toISOString() : null;
    const endIso = endTime ? new Date(endTime).toISOString() : null;
    if (startIso && endIso && new Date(endIso) <= new Date(startIso)) {
      showToast('Waktu tutup ujian harus lebih akhir dari waktu buka ujian!', 'warning');
      return;
    }

    setLoading(true, editingId ? 'Memperbarui jadwal ujian...' : 'Menyimpan jadwal ujian baru...');
    try {
      const sb = ensureSupabase();
      const payload = {
        title: title.trim(),
        subject,
        packet_code: packetCode.trim().toUpperCase() || 'SEMUA',
        target_class: allClasses ? 'SEMUA' : selectedClasses.join(', '),
        target_session: targetSession,
        duration: duration || 60,
        max_questions: maxQuestions || 0,
        token: token.trim().toUpperCase() || generateRandomToken(),
        randomize,
        randomize_options: randomizeOptions,
        require_proctor_pin: requireProctorPin,
        show_result: showResult,
        max_violations: maxViolations,
        source_type: sourceType,
        gform_url: sourceType === 'gform' ? gformUrl.trim() : '',
        exam_mode: examMode,
        start_time: startIso,
        end_time: endIso,
      };
      if (editingId) {
        const { error } = await sb.from('cbt_exams').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await sb.from('cbt_exams').insert({
          id: 'ex_' + Date.now(),
          status: 'aktif',
          created_by: currentUser.name || 'Admin',
          ...payload,
        });
        if (error) throw error;
      }
      await onSync();
      showToast(editingId ? 'Perubahan jadwal ujian berhasil disimpan!' : 'Jadwal ujian baru berhasil diaktifkan!', 'success');
      resetForm();
    } catch (err) {
      showToast('Gagal menyimpan jadwal ujian: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const regenerateToken = async (examId: string) => {
    const newTok = generateRandomToken();
    setLoading(true, 'Mengacak token ujian baru...');
    try {
      const sb = ensureSupabase();
      const { error } = await sb.from('cbt_exams').update({ token: newTok }).eq('id', examId);
      if (error) throw error;
      await onSync();
      showToast(`Token baru berhasil dibuat: ${newTok}`, 'success');
    } catch (err) {
      showToast('Gagal memperbarui token: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (examId: string, newStatus: 'aktif' | 'nonaktif') => {
    setLoading(true, `Mengubah status menjadi ${newStatus}...`);
    try {
      const sb = ensureSupabase();
      const { error } = await sb.from('cbt_exams').update({ status: newStatus }).eq('id', examId);
      if (error) throw error;
      await onSync();
      showToast(`Status jadwal ujian diubah menjadi ${newStatus.toUpperCase()}.`, 'info');
    } catch (err) {
      showToast('Gagal mengubah status: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const openClassModal = (ex: ExamSchedule) => {
    const rawCls = String(ex.targetClass || 'SEMUA').trim();
    const isAll = rawCls.toUpperCase() === 'SEMUA';
    setClassModalExam(ex);
    setModalAllClasses(isAll);
    setModalSelectedClasses(
      isAll
        ? []
        : rawCls
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean)
    );
  };

  const saveModalClasses = async () => {
    if (!classModalExam) return;
    if (!modalAllClasses && modalSelectedClasses.length === 0) {
      showToast('Pilih minimal satu kelas atau centang SEMUA KELAS!', 'warning');
      return;
    }
    setLoading(true, 'Memperbarui target kelas...');
    try {
      const sb = ensureSupabase();
      const { error } = await sb
        .from('cbt_exams')
        .update({ target_class: modalAllClasses ? 'SEMUA' : modalSelectedClasses.join(', ') })
        .eq('id', classModalExam.id);
      if (error) throw error;
      setClassModalExam(null);
      await onSync();
      showToast('Target kelas ujian berhasil diperbarui!', 'success');
    } catch (err) {
      showToast('Gagal: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5">
        <div
          className={`bg-white p-6 rounded-2xl border shadow-sm transition-all ${
            editingId ? 'ring-2 ring-amber-400 border-amber-300' : 'border-slate-200'
          }`}
        >
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            {editingId ? <Edit3 className="w-4 h-4 text-amber-500" /> : <CalendarPlus className="w-4 h-4 text-indigo-600" />}
            {editingId ? 'Edit Jadwal Ujian' : 'Buat Jadwal Ujian Baru'}
          </h3>

          <form onSubmit={handleSave} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Judul / Nama Ujian</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Sumatif Akhir Semester Matematika"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Mata Pelajaran</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white outline-none"
                >
                  {subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Kode Paket Soal</label>
                <input
                  type="text"
                  value={packetCode}
                  onChange={(e) => setPacketCode(e.target.value.toUpperCase())}
                  placeholder="SEMUA / PAKET-A"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-mono text-xs uppercase font-bold outline-none"
                />
              </div>
            </div>

            {sourceType === 'gform' ? (
              <div className="px-3 py-2 rounded-xl bg-purple-50 border border-purple-200 text-[11px] font-semibold text-purple-800">
                Sumber soal menggunakan tautan eksternal Google Form.
              </div>
            ) : matchedQuestionsCount > 0 ? (
              <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800">
                Tersedia <strong>{matchedQuestionsCount} butir soal</strong> di Bank Soal untuk {subject} ({packetCode || 'SEMUA'}).
              </div>
            ) : (
              <div className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-700">
                Belum ada soal di Bank Soal untuk {subject} ({packetCode || 'SEMUA'}).
              </div>
            )}

            <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-bold text-slate-700">Target Kelas (Bisa Pilih &gt; 1)</label>
                <span className="text-[11px] font-extrabold text-indigo-700">
                  {allClasses
                    ? 'SEMUA KELAS'
                    : selectedClasses.length === 0
                    ? 'Belum dipilih'
                    : `${selectedClasses.length} Kelas Dipilih`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200/80">
                <label className="inline-flex items-center gap-2 text-xs font-extrabold text-indigo-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allClasses}
                    onChange={(e) => {
                      setAllClasses(e.target.checked);
                      if (e.target.checked) setSelectedClasses([]);
                    }}
                    className="rounded text-indigo-600"
                  />
                  <span>SEMUA KELAS</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setAllClasses(false);
                    setSelectedClasses([]);
                  }}
                  className="text-[11px] font-bold text-slate-500 hover:text-rose-600"
                >
                  Reset Pilihan
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-0.5">
                {classes.map((c) => {
                  const checked = !allClasses && selectedClasses.includes(c);
                  return (
                    <label
                      key={c}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer hover:border-indigo-400 select-none"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setAllClasses(false);
                          setSelectedClasses((prev) =>
                            prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                          );
                        }}
                        className="rounded text-indigo-600"
                      />
                      <span>{c}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Target Sesi</label>
              <select
                value={targetSession}
                onChange={(e) => setTargetSession(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white outline-none"
              >
                <option value="SEMUA">SEMUA SESI</option>
                {sessions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Durasi (Menit)</label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value, 10) || 60)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-center outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Batas Soal (0 = Semua)</label>
                <input
                  type="number"
                  min={0}
                  value={maxQuestions}
                  onChange={(e) => setMaxQuestions(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-center outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Token Ujian</label>
                <input
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-mono text-xs uppercase font-black text-center text-indigo-700 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Batas Maks. Pelanggaran</label>
                <select
                  value={maxViolations}
                  onChange={(e) => setMaxViolations(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white text-rose-700 outline-none"
                >
                  <option value={1}>1x Pelanggaran (Langsung Kumpul)</option>
                  <option value={2}>2x Pelanggaran</option>
                  <option value={3}>3x Pelanggaran (Standar)</option>
                  <option value={5}>5x Pelanggaran</option>
                  <option value={10}>10x Pelanggaran</option>
                  <option value={0}>Tanpa Batas (Peringatan Saja)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Mode Pengawasan &amp; Keamanan Layar</label>
              <select
                value={examMode}
                onChange={(e) => setExamMode(e.target.value as 'strict' | 'relaxed')}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white outline-none"
              >
                <option value="strict">Mode Ketat (Wajib Fullscreen, Sirine &amp; Blokir Pindah Tab)</option>
                <option value="relaxed">Mode Toleran (Latihan / Tanpa Kunci Fullscreen &amp; Sirine)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Waktu Buka Otomatis</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Waktu Tutup Otomatis</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Sumber Soal Ujian</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as 'internal' | 'gform')}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white outline-none"
              >
                <option value="internal">Bank Soal CBT Internal (Otomatis Koreksi)</option>
                <option value="gform">Tautan Google Form (Mode Terkunci Fullscreen)</option>
              </select>
            </div>

            {sourceType === 'gform' && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">URL Google Form</label>
                <input
                  type="url"
                  value={gformUrl}
                  onChange={(e) => setGformUrl(e.target.value)}
                  placeholder="https://docs.google.com/forms/d/e/.../viewform"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs outline-none"
                />
              </div>
            )}

            <div className="space-y-2 pt-1 text-xs">
              <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={randomize} onChange={(e) => setRandomize(e.target.checked)} className="rounded text-indigo-600" />
                Acak Urutan Soal per Siswa
              </label>
              <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={randomizeOptions}
                  onChange={(e) => setRandomizeOptions(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                Acak Pilihan Jawaban (A/B/C/D)
              </label>
              <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireProctorPin}
                  onChange={(e) => setRequireProctorPin(e.target.checked)}
                  className="rounded text-rose-600"
                />
                Kunci Layar Pelanggaran Wajib PIN Pengawas Ruang
              </label>
              <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showResult}
                  onChange={(e) => setShowResult(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                Tampilkan Nilai ke Siswa Setelah Selesai
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm shadow transition inline-flex items-center justify-center gap-2 ${
                  editingId ? 'bg-amber-500 hover:bg-amber-600 text-slate-950' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {editingId ? <Save className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                {editingId ? 'Simpan Perubahan Jadwal' : 'Aktifkan Jadwal Ujian'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                >
                  Batal
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="lg:col-span-7 space-y-3">
        {cache.exams.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
            Belum ada jadwal ujian di tabel cbt_exams.
          </div>
        ) : (
          cache.exams.map((ex) => {
            const matchedQCount = cache.questions.filter((q) => {
              const sameSub = q.subject.trim().toLowerCase() === ex.subject.trim().toLowerCase();
              const pkt = (ex.packetCode || 'SEMUA').trim().toUpperCase();
              const samePkt = pkt === 'SEMUA' || q.packetCode.trim().toUpperCase() === pkt;
              return sameSub && samePkt;
            }).length;

            const isRelaxedMode = ex.examMode === 'relaxed';
            const violLabel = isRelaxedMode
              ? 'Mode Toleran'
              : ex.maxViolations > 0
              ? `Mode Ketat · Maks. ${ex.maxViolations}x`
              : 'Mode Ketat · Tanpa Batas';

            return (
              <div
                key={ex.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span
                      className={`font-extrabold uppercase ${
                        ex.status === 'aktif' ? 'text-emerald-700' : 'text-slate-500'
                      }`}
                    >
                      {ex.status}
                    </span>
                    <span>·</span>
                    <span className="font-mono font-black text-indigo-700 tabular-nums">TOKEN: {ex.token}</span>
                    <span>·</span>
                    <span className="font-bold tabular-nums">{ex.duration} Menit</span>
                    <span>·</span>
                    <span className="font-bold">
                      {ex.sourceType === 'gform' ? 'Google Form' : `${matchedQCount} Soal`}
                    </span>
                    <span>·</span>
                    <span className={`inline-flex items-center gap-1 font-bold ${isRelaxedMode ? 'text-sky-700' : 'text-rose-700'}`}>
                      <Shield className="w-3.5 h-3.5" /> {violLabel}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-base">{ex.title}</h4>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span>
                      {ex.subject} · Paket: <strong>{ex.packetCode}</strong> · Sesi: <strong>{ex.targetSession}</strong> · Kelas:{' '}
                      <strong className="text-indigo-700">{ex.targetClass}</strong>
                    </span>
                  </div>
                  {(ex.startTime || ex.endTime) && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg inline-block">
                      {ex.startTime ? `Buka: ${formatDateTimeIndo(ex.startTime)}` : 'Buka: Langsung'}
                      {ex.endTime ? ` · Tutup: ${formatDateTimeIndo(ex.endTime)}` : ''}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(ex)}
                    className="px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold inline-flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => openClassModal(ex)}
                    className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold inline-flex items-center gap-1"
                  >
                    <Users className="w-3.5 h-3.5" /> Kelas
                  </button>
                  <button
                    type="button"
                    onClick={() => regenerateToken(ex.id)}
                    className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold inline-flex items-center gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Token Baru
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleStatus(ex.id, ex.status === 'aktif' ? 'nonaktif' : 'aktif')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold ${
                      ex.status === 'aktif' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {ex.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteRecord('cbt_exams', ex.id)}
                    className="p-2 rounded-xl text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {classModalExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-800">Target Kelas · {classModalExam.title}</h3>
            <label className="inline-flex items-center gap-2 text-xs font-extrabold text-indigo-700 cursor-pointer">
              <input
                type="checkbox"
                checked={modalAllClasses}
                onChange={(e) => {
                  setModalAllClasses(e.target.checked);
                  if (e.target.checked) setModalSelectedClasses([]);
                }}
              />
              <span>SEMUA KELAS</span>
            </label>
            <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 max-h-48 overflow-y-auto">
              {classes.map((c) => (
                <label key={c} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!modalAllClasses && modalSelectedClasses.includes(c)}
                    onChange={() => {
                      setModalAllClasses(false);
                      setModalSelectedClasses((prev) =>
                        prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                      );
                    }}
                  />
                  <span>{c}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setClassModalExam(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Batal
              </button>
              <button type="button" onClick={saveModalClasses} className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white">
                Simpan Target Kelas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
