import React, { useState } from 'react';
import mammoth from 'mammoth';
import {
  CheckCircle2,
  Edit3,
  FileText,
  Headphones,
  Image as ImageIcon,
  PlusCircle,
  Save,
  Trash2,
} from 'lucide-react';
import { ensureSupabase, uploadMediaToSupabaseStorage } from '../lib/supabase';
import { getOfficialSubjectNames, isSubjectAllowedForUser } from '../lib/utils';
import type { AppCache, Question, QuestionType, ToastItem, UserSession } from '../types/cbt';
import { MathText } from './MathText';

interface QuestionBankViewProps {
  cache: AppCache;
  currentUser: UserSession;
  onSync: () => Promise<void>;
  onDeleteRecord: (table: string, id: string) => void;
  setLoading: (val: boolean, text?: string) => void;
  showToast: (msg: string, type?: ToastItem['type']) => void;
}

export const QuestionBankView: React.FC<QuestionBankViewProps> = ({
  cache,
  currentUser,
  onSync,
  onDeleteRecord,
  setLoading,
  showToast,
}) => {
  const allSubjects = getOfficialSubjectNames(cache);
  const allowedSubjects =
    currentUser.role === 'guru'
      ? allSubjects.filter((s) => isSubjectAllowedForUser(currentUser, s))
      : allSubjects;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [subject, setSubject] = useState(allowedSubjects[0] || '');
  const [packetCode, setPacketCode] = useState('PAKET-A');
  const [qType, setQType] = useState<QuestionType>('pg');
  const [weight, setWeight] = useState(1);
  const [questionText, setQuestionText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [audioMaxPlays, setAudioMaxPlays] = useState(2);
  const [options, setOptions] = useState<string[]>(['', '', '', '', '']);
  const [pgKey, setPgKey] = useState(0);
  const [pgkKeys, setPgkKeys] = useState<number[]>([]);
  const [bsKey, setBsKey] = useState<'BENAR' | 'SALAH'>('BENAR');
  const [essayMode, setEssayMode] = useState<'auto' | 'manual'>('auto');
  const [essayKey, setEssayKey] = useState('');
  const [filterSubject, setFilterSubject] = useState('ALL');

  if (allowedSubjects.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-amber-900 text-sm font-semibold">
        Akun Guru Anda belum ditugaskan pada mata pelajaran manapun. Hubungi Administrator.
      </div>
    );
  }

  const questions = cache.questions.filter((q) => isSubjectAllowedForUser(currentUser, q.subject));
  const visibleQuestions =
    filterSubject === 'ALL' ? questions : questions.filter((q) => q.subject === filterSubject);

  const resetForm = () => {
    setEditingId(null);
    setQuestionText('');
    setImageUrl('');
    setAudioUrl('');
    setOptions(['', '', '', '', '']);
    setPgKey(0);
    setPgkKeys([]);
    setBsKey('BENAR');
    setEssayMode('auto');
    setEssayKey('');
  };

  const handleEdit = (q: Question) => {
    setEditingId(q.id);
    setSubject(q.subject);
    setPacketCode(q.packetCode || 'PAKET-A');
    setQType(q.type || 'pg');
    setWeight(q.questionWeight || 1);
    setQuestionText(q.question || '');
    setImageUrl(q.image || '');
    setAudioUrl(q.audioUrl || '');
    setAudioMaxPlays(q.audioMaxPlays ?? 2);

    const opts = [0, 1, 2, 3, 4].map((idx) => (q.options && q.options[idx] ? q.options[idx] : ''));
    setOptions(opts);

    if (q.type === 'pg') {
      setPgKey(Number(q.answer) || 0);
    } else if (q.type === 'pgk') {
      setPgkKeys(Array.isArray(q.answer) ? q.answer.map(Number) : []);
    } else if (q.type === 'bs') {
      setBsKey(String(q.answer || 'BENAR').toUpperCase() === 'SALAH' ? 'SALAH' : 'BENAR');
    } else if (q.type === 'esai') {
      setEssayMode(q.essayGradingMode === 'manual' ? 'manual' : 'auto');
      setEssayKey(String(q.answer || ''));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true, 'Mengompresi & mengunggah gambar...');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const cloudUrl = await uploadMediaToSupabaseStorage(
        file,
        'images',
        file.name.split('.').pop() || 'jpg'
      );
      setImageUrl(cloudUrl || String(ev.target?.result || ''));
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true, 'Mengunggah audio listening...');
    try {
      const cloudUrl = await uploadMediaToSupabaseStorage(
        file,
        'audio',
        file.name.split('.').pop() || 'mp3'
      );
      if (cloudUrl) {
        setAudioUrl(cloudUrl);
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => setAudioUrl(String(ev.target?.result || ''));
        reader.readAsDataURL(file);
      }
      showToast(`Audio siap: ${file.name}`, 'success');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalOptions: string[] = [];
    let finalAnswer: unknown = null;

    if (qType === 'pg' || qType === 'pgk') {
      finalOptions = options.map((o) => o.trim()).filter((v, i) => i < 4 || v !== '');
      if (finalOptions.slice(0, 4).some((o) => !o)) {
        showToast('Pilihan A, B, C, dan D wajib diisi!', 'warning');
        return;
      }
      if (qType === 'pg') {
        finalAnswer = pgKey;
      } else {
        if (pgkKeys.length === 0) {
          showToast('Pilih minimal 1 kunci jawaban untuk PG Kompleks!', 'warning');
          return;
        }
        finalAnswer = pgkKeys;
      }
    } else if (qType === 'bs') {
      finalOptions = ['BENAR', 'SALAH'];
      finalAnswer = bsKey;
    } else {
      finalAnswer = essayKey.trim();
    }

    setLoading(true, 'Menyimpan butir soal ke cbt_questions...');
    try {
      const sb = ensureSupabase();
      const payload = {
        id: editingId || 'q_' + Date.now(),
        subject,
        packet_code: packetCode.trim().toUpperCase() || 'PAKET-A',
        question_type: qType,
        question: questionText.trim(),
        image: imageUrl,
        audio_url: audioUrl,
        audio_max_plays: audioMaxPlays,
        options: finalOptions,
        answer: finalAnswer,
        essay_grading_mode: qType === 'esai' ? essayMode : 'auto',
        question_weight: weight || 1,
        created_by_name: currentUser.name || 'Guru',
      };
      const { error } = await sb.from('cbt_questions').upsert(payload);
      if (error) throw error;
      await onSync();
      showToast('Butir soal berhasil disimpan!', 'success');
      resetForm();
    } catch (err) {
      showToast('Gagal menyimpan soal: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDocxImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const pkt = packetCode.trim().toUpperCase() || 'PAKET-A';
    setLoading(true, 'Membaca dokumen Word (.docx)...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const lines = result.value
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      const parsed: Array<{ question: string; options: string[]; answer: number }> = [];
      let current: { question: string; options: string[]; answer: number } | null = null;

      for (const line of lines) {
        const qMatch = line.match(/^(\d+)[.)]\s+(.+)/);
        const optMatch = line.match(/^([A-E])[.)]\s+(.+)/i);
        const keyMatch = line.match(/^KUNCI\s*[:=]\s*([A-E])/i);

        if (qMatch) {
          if (current && current.question && current.options.length >= 2) parsed.push(current);
          current = { question: qMatch[2].trim(), options: [], answer: 0 };
        } else if (optMatch && current) {
          current.options.push(optMatch[2].trim());
        } else if (keyMatch && current) {
          current.answer = keyMatch[1].toUpperCase().charCodeAt(0) - 65;
        } else if (current && current.options.length === 0) {
          current.question += '\n' + line;
        }
      }
      if (current && current.question && current.options.length >= 2) parsed.push(current);

      if (parsed.length === 0) {
        showToast(
          'Format soal di file Word tidak terbaca. Pastikan memakai penomoran 1. dan opsi A. B. C. D.',
          'warning'
        );
        return;
      }

      const records = parsed.map((p, idx) => ({
        id: `q_docx_${Date.now()}_${idx}`,
        subject,
        packet_code: pkt,
        question_type: 'pg',
        question: p.question,
        options: p.options,
        answer: p.answer,
        question_weight: 1,
        created_by_name: currentUser.name || 'Guru',
      }));

      const sb = ensureSupabase();
      const { error } = await sb.from('cbt_questions').insert(records);
      if (error) throw error;
      await onSync();
      showToast(`${records.length} soal dari Word berhasil diimpor ke paket ${pkt}!`, 'success');
    } catch (err) {
      showToast('Gagal mengimpor Word: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-6 space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-indigo-600" />
              {editingId ? 'Mode Edit Soal' : 'Input / Edit Butir Soal'}
            </h3>
            <button type="button" onClick={resetForm} className="text-xs font-bold text-slate-500 hover:text-indigo-600">
              Reset Form
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Mata Pelajaran</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white outline-none"
                >
                  {allowedSubjects.map((s) => (
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
                  required
                  value={packetCode}
                  onChange={(e) => setPacketCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-mono text-xs uppercase font-bold outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tipe Soal</label>
                <select
                  value={qType}
                  onChange={(e) => setQType(e.target.value as QuestionType)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white outline-none"
                >
                  <option value="pg">Pilihan Ganda (1 Jawaban)</option>
                  <option value="pgk">Pilihan Ganda Kompleks (&gt;1 Jawaban)</option>
                  <option value="bs">Benar / Salah</option>
                  <option value="esai">Isian Singkat / Esai</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Bobot Skor Soal</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={weight}
                  onChange={(e) => setWeight(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-center outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Pertanyaan / Stimulus Soal (Mendukung LaTeX $...$)
              </label>
              <textarea
                rows={3}
                required
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Tulis pertanyaan di sini... Gunakan $x^2 + y^2 = r^2$ untuk rumus matematika."
                className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 inline-flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-600" /> Gambar Soal (Opsional)
                </label>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="block w-full text-[11px] text-slate-500" />
                {imageUrl && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <img src={imageUrl} alt="Preview soal" referrerPolicy="no-referrer" className="h-14 rounded-lg border" />
                    <button type="button" onClick={() => setImageUrl('')} className="text-[10px] font-bold text-rose-600">
                      Hapus
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 inline-flex items-center gap-1">
                  <Headphones className="w-3.5 h-3.5 text-amber-600" /> Audio Listening (MP3/WAV)
                </label>
                <input type="file" accept="audio/*" onChange={handleAudioUpload} className="block w-full text-[11px] text-slate-500" />
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] font-bold text-slate-500">Batas Putar:</span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={audioMaxPlays}
                    onChange={(e) => setAudioMaxPlays(parseInt(e.target.value, 10) || 0)}
                    className="w-14 px-2 py-0.5 rounded border border-slate-300 text-xs font-bold text-center"
                  />
                  <span className="text-[10px] text-slate-400">(0 = Bebas)</span>
                </div>
                {audioUrl && <p className="mt-1 text-[11px] text-emerald-700 font-bold">Audio listening siap</p>}
              </div>
            </div>

            {(qType === 'pg' || qType === 'pgk') && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600">Pilihan Jawaban &amp; Kunci Jawaban</label>
                {[0, 1, 2, 3, 4].map((idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      {qType === 'pg' ? (
                        <input
                          type="radio"
                          name="q-pg-key"
                          checked={pgKey === idx}
                          onChange={() => setPgKey(idx)}
                          className="text-indigo-600"
                        />
                      ) : (
                        <input
                          type="checkbox"
                          checked={pgkKeys.includes(idx)}
                          onChange={() =>
                            setPgkKeys((prev) =>
                              prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]
                            )
                          }
                          className="rounded text-indigo-600"
                        />
                      )}
                      <span className="w-6 text-xs font-extrabold text-slate-500">{letter}.</span>
                      <input
                        type="text"
                        value={options[idx] || ''}
                        onChange={(e) => {
                          const next = [...options];
                          next[idx] = e.target.value;
                          setOptions(next);
                        }}
                        placeholder={`Teks pilihan ${letter} ${idx === 4 ? '(Opsional)' : ''}`}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {qType === 'bs' && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Kunci Jawaban Benar / Salah</label>
                <select
                  value={bsKey}
                  onChange={(e) => setBsKey(e.target.value as 'BENAR' | 'SALAH')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                >
                  <option value="BENAR">BENAR</option>
                  <option value="SALAH">SALAH</option>
                </select>
              </div>
            )}

            {qType === 'esai' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Metode Koreksi Esai</label>
                  <select
                    value={essayMode}
                    onChange={(e) => setEssayMode(e.target.value as 'auto' | 'manual')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                  >
                    <option value="auto">Otomatis (Kata Kunci)</option>
                    <option value="manual">Koreksi Manual Guru</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Kunci Jawaban Singkat</label>
                  <input
                    type="text"
                    value={essayKey}
                    onChange={(e) => setEssayKey(e.target.value)}
                    placeholder="Jawaban singkat..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow transition inline-flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> Simpan Butir Soal ke Bank Soal
            </button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" /> Impor Soal Otomatis dari Microsoft Word (.docx)
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Format penulisan di Word: Awali nomor soal dengan <code className="bg-slate-100 px-1 rounded">1. Pertanyaan...</code>,
            opsi dengan <code className="bg-slate-100 px-1 rounded">A. ...</code> s/d{' '}
            <code className="bg-slate-100 px-1 rounded">E. ...</code>, dan baris kunci dengan{' '}
            <code className="bg-slate-100 px-1 rounded">KUNCI: A</code>.
          </p>
          <input
            type="file"
            accept=".docx"
            onChange={handleDocxImport}
            className="block w-full text-xs text-slate-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
      </div>

      <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-slate-800">Daftar Bank Soal ({visibleQuestions.length} Butir)</h3>
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold bg-white"
          >
            <option value="ALL">Semua Mapel Diampu</option>
            {allowedSubjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="p-4 space-y-3 max-h-[760px] overflow-y-auto">
          {visibleQuestions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Belum ada soal di Bank Soal.</div>
          ) : (
            visibleQuestions.map((q, idx) => (
              <div key={q.id} className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 transition space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white font-bold tabular-nums">#{idx + 1}</span>
                    <span className="font-bold text-slate-700">{q.subject}</span>
                    <span className="text-slate-300">·</span>
                    <span className="font-mono font-bold text-amber-700">{q.packetCode}</span>
                    <span className="text-slate-300">·</span>
                    <span className="font-bold uppercase text-purple-600">{q.type}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => handleEdit(q)} className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => onDeleteRecord('cbt_questions', q.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-sm text-slate-800 leading-relaxed">
                  <MathText text={q.question} />
                </div>
                {q.image && (
                  <img src={q.image} alt="Gambar soal" referrerPolicy="no-referrer" className="max-h-36 rounded-xl border border-slate-200" />
                )}
                {q.audioUrl && (
                  <div className="text-xs text-amber-700 font-bold inline-flex items-center gap-1">
                    <Headphones className="w-3.5 h-3.5" /> Audio Listening Terlampir (Maks. {q.audioMaxPlays}x putar)
                  </div>
                )}
                {Array.isArray(q.options) && q.options.length > 0 ? (
                  <div className="grid grid-cols-1 gap-1 pt-1 text-xs">
                    {q.options.map((opt, oIdx) => {
                      const isKey =
                        q.type === 'pg'
                          ? Number(q.answer) === oIdx
                          : Array.isArray(q.answer) && q.answer.map(Number).includes(oIdx);
                      return (
                        <div
                          key={oIdx}
                          className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${
                            isKey ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200' : 'text-slate-600'
                          }`}
                        >
                          <span>{String.fromCharCode(65 + oIdx)}.</span>
                          <MathText text={opt} className="flex-1" />
                          {isKey && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs font-bold text-emerald-700">Kunci: {JSON.stringify(q.answer)}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
