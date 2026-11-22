import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Clock,
  CloudDownload,
  DoorOpen,
  Edit3,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  Save,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { ensureSupabase, uploadMediaToSupabaseStorage } from '../lib/supabase';
import type {
  AppCache,
  ExamRoom,
  ExamSession,
  SchoolClass,
  SchoolSettings,
  Subject,
  ToastItem,
} from '../types/cbt';

interface SchoolSettingsViewProps {
  school: SchoolSettings;
  onSaveSuccess: (updated: SchoolSettings) => void;
  setLoading: (val: boolean, text?: string) => void;
  showToast: (msg: string, type?: ToastItem['type']) => void;
}

export const SchoolSettingsView: React.FC<SchoolSettingsViewProps> = ({
  school,
  onSaveSuccess,
  setLoading,
  showToast,
}) => {
  const [form, setForm] = useState<SchoolSettings>({ ...school });
  const [logoMode, setLogoMode] = useState<'upload' | 'url'>('upload');

  useEffect(() => {
    setForm({ ...school });
  }, [school]);

  const resizeImageToDataUrl = (file: File, maxDim = 320): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
      reader.onload = () => {
        const raw = String(reader.result || '');
        if (file.type === 'image/svg+xml') {
          resolve(raw);
          return;
        }
        const img = new Image();
        img.onerror = () => resolve(raw);
        img.onload = () => {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(raw);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png'));
        };
        img.src = raw;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Pilih file gambar yang valid (PNG, JPG, WEBP, atau SVG).', 'warning');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      showToast('Ukuran gambar maksimal 3 MB.', 'warning');
      return;
    }

    setLoading(true, 'Mengunggah logo sekolah...');
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const cloudUrl = await uploadMediaToSupabaseStorage(file, 'logos', ext);
      if (cloudUrl) {
        setForm((prev) => ({ ...prev, logo_url: cloudUrl }));
        showToast('Logo berhasil diunggah ke Cloud Storage! Klik Simpan untuk menerapkan.', 'success');
      } else {
        const dataUrl = await resizeImageToDataUrl(file, 320);
        setForm((prev) => ({ ...prev, logo_url: dataUrl }));
        showToast('Logo siap digunakan (tersimpan lokal ke database). Klik Simpan Identitas Sekolah.', 'info');
      }
    } catch (err) {
      showToast('Gagal memproses gambar logo: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true, 'Menyimpan ke tabel cbt_school_settings...');
    try {
      const sb = ensureSupabase();
      const payload: SchoolSettings = { ...form, id: 'main', city: form.city.trim() || 'Cirebon' };
      const { error } = await sb.from('cbt_school_settings').upsert(payload);
      if (error) throw error;
      onSaveSuccess(payload);
      showToast('Identitas & Kop Sekolah berhasil disimpan!', 'success');
    } catch (err) {
      showToast('Gagal menyimpan pengaturan: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-600 mb-1">Nama Sekolah</label>
            <input
              type="text"
              required
              value={form.school_name}
              onChange={(e) => setForm({ ...form, school_name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">NPSN</label>
            <input
              type="text"
              value={form.npsn}
              onChange={(e) => setForm({ ...form, npsn: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            Instansi / Dinas Pendidikan (Header Atas Kop Surat)
          </label>
          <input
            type="text"
            value={form.education_office}
            onChange={(e) => setForm({ ...form, education_office: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-600 mb-1">Alamat Lengkap Sekolah</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Kota / Kab. Tanda Tangan</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Contoh: Cirebon"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:border-indigo-500 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Tahun Pelajaran</label>
            <input
              type="text"
              value={form.academic_year}
              onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Semester</label>
            <select
              value={form.semester}
              onChange={(e) => setForm({ ...form, semester: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:border-indigo-500 outline-none"
            >
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-indigo-600" /> Logo Sekolah (Untuk Login, Kartu &amp; Kop Berita Acara)
            </label>
            <div className="inline-flex rounded-xl bg-white p-1 border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setLogoMode('upload')}
                className={`px-3 py-1 rounded-lg inline-flex items-center gap-1 transition ${
                  logoMode === 'upload'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Upload className="w-3.5 h-3.5" /> Upload File
              </button>
              <button
                type="button"
                onClick={() => setLogoMode('url')}
                className={`px-3 py-1 rounded-lg inline-flex items-center gap-1 transition ${
                  logoMode === 'url'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" /> Pakai URL
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
              {form.logo_url ? (
                <img
                  src={form.logo_url}
                  alt="Preview Logo Sekolah"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain p-1.5"
                />
              ) : (
                <span className="text-[11px] font-bold text-slate-400 text-center px-2">
                  Belum Ada Logo
                </span>
              )}
            </div>

            <div className="flex-1 w-full space-y-2">
              {logoMode === 'upload' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold cursor-pointer inline-flex items-center gap-2 transition">
                    <Upload className="w-4 h-4" /> Pilih File Logo (PNG/JPG/SVG)
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  {form.logo_url && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, logo_url: '' })}
                      className="px-3 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold inline-flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" /> Hapus Logo
                    </button>
                  )}
                  <p className="w-full text-[11px] text-slate-500">
                    Otomatis diunggah ke Supabase Storage (bucket <span className="font-mono">cbt-media</span>) atau dikompresi otomatis ke database.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={form.logo_url}
                    onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                    placeholder="https://contoh.com/logo-sekolah.png"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:border-indigo-500 outline-none"
                  />
                  {form.logo_url && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, logo_url: '' })}
                      className="px-3 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold shrink-0"
                      title="Hapus URL Logo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Nama Kepala Sekolah</label>
            <input
              type="text"
              value={form.principal_name}
              onChange={(e) => setForm({ ...form, principal_name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">NIP Kepala Sekolah</label>
            <input
              type="text"
              value={form.principal_nip}
              onChange={(e) => setForm({ ...form, principal_nip: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Nama Ketua Panitia Ujian</label>
            <input
              type="text"
              value={form.committee_head}
              onChange={(e) => setForm({ ...form, committee_head: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">NIP Ketua Panitia</label>
            <input
              type="text"
              value={form.committee_nip}
              onChange={(e) => setForm({ ...form, committee_nip: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 outline-none"
            />
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow transition inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Simpan Identitas Sekolah
          </button>
        </div>
      </form>
    </div>
  );
};

interface MasterDataViewProps {
  cache: AppCache;
  onSync: () => Promise<void>;
  onDeleteRecord: (table: string, id: string) => void;
  setLoading: (val: boolean, text?: string) => void;
  showToast: (msg: string, type?: ToastItem['type']) => void;
}

export const MasterDataView: React.FC<MasterDataViewProps> = ({
  cache,
  onSync,
  onDeleteRecord,
  setLoading,
  showToast,
}) => {
  const [bulkKelas, setBulkKelas] = useState(cache.classes[0]?.name || '');
  const [bulkRuang, setBulkRuang] = useState(cache.rooms[0]?.name || '');
  const [bulkSesi, setBulkSesi] = useState(cache.sessions[0]?.name || '');

  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');
  const [subKktp, setSubKktp] = useState(75);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const [clsName, setClsName] = useState('');
  const [clsGrade, setClsGrade] = useState('');
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);

  const [rmName, setRmName] = useState('');
  const [rmCap, setRmCap] = useState(32);
  const [rmLoc, setRmLoc] = useState('');
  const [rmPin, setRmPin] = useState('');
  const [editingRoom, setEditingRoom] = useState<ExamRoom | null>(null);

  const [sesName, setSesName] = useState('');
  const [sesTime, setSesTime] = useState('');
  const [editingSession, setEditingSession] = useState<ExamSession | null>(null);

  const executeBulkAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const affected = cache.students.filter((s) => s.kelas === bulkKelas);
    if (affected.length === 0) {
      showToast(`Tidak ada siswa di kelas ${bulkKelas}.`, 'warning');
      return;
    }
    setLoading(true, `Memindahkan ${affected.length} siswa kelas ${bulkKelas}...`);
    try {
      const sb = ensureSupabase();
      const { error } = await sb
        .from('cbt_students')
        .update({ exam_room: bulkRuang, exam_session: bulkSesi })
        .eq('kelas', bulkKelas);
      if (error) throw error;
      await onSync();
      showToast(`Berhasil! ${affected.length} siswa kelas ${bulkKelas} dialokasikan ke ${bulkRuang} (${bulkSesi}).`, 'success');
    } catch (err) {
      showToast('Gagal plotting massal: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName.trim()) return;
    setLoading(true, 'Menyimpan ke cbt_subjects...');
    try {
      const sb = ensureSupabase();
      const { error } = await sb.from('cbt_subjects').insert({
        id: 'sub_' + Date.now(),
        code: subCode.trim().toUpperCase(),
        name: subName.trim(),
        kktp: subKktp || 75,
      });
      if (error) throw error;
      setSubName('');
      setSubCode('');
      setSubKktp(75);
      await onSync();
      showToast(`Mata pelajaran ${subName} disimpan!`, 'success');
    } catch (err) {
      showToast('Gagal menyimpan mapel: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSubject = async () => {
    if (!editingSubject || !editingSubject.name.trim()) return;
    setLoading(true, 'Memperbarui cbt_subjects...');
    try {
      const sb = ensureSupabase();
      const oldSub = cache.subjects.find((s) => s.id === editingSubject.id);
      const rowId = editingSubject.id.startsWith('def_') ? 'sub_' + Date.now() : editingSubject.id;
      const { error } = await sb.from('cbt_subjects').upsert({
        id: rowId,
        code: editingSubject.code.toUpperCase(),
        name: editingSubject.name.trim(),
        kktp: editingSubject.kktp || 75,
      });
      if (error) throw error;
      if (oldSub && oldSub.name !== editingSubject.name.trim()) {
        await sb.from('cbt_questions').update({ subject: editingSubject.name.trim() }).eq('subject', oldSub.name);
        await sb.from('cbt_exams').update({ subject: editingSubject.name.trim() }).eq('subject', oldSub.name);
      }
      setEditingSubject(null);
      await onSync();
      showToast('Mata pelajaran diperbarui!', 'success');
    } catch (err) {
      showToast('Gagal: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const seedDefaultSmpSubjects = async () => {
    const standardSmp = [
      { name: 'Pendidikan Agama dan Budi Pekerti', code: 'PABP', kktp: 75 },
      { name: 'Pendidikan Pancasila', code: 'PPKN', kktp: 75 },
      { name: 'Bahasa Indonesia', code: 'BIN', kktp: 75 },
      { name: 'Matematika', code: 'MTK', kktp: 75 },
      { name: 'Ilmu Pengetahuan Alam (IPA)', code: 'IPA', kktp: 75 },
      { name: 'Ilmu Pengetahuan Sosial (IPS)', code: 'IPS', kktp: 75 },
      { name: 'Bahasa Inggris', code: 'BIG', kktp: 75 },
      { name: 'Pendidikan Jasmani, Olahraga, dan Kesehatan', code: 'PJOK', kktp: 75 },
      { name: 'Informatika', code: 'INF', kktp: 75 },
      { name: 'Seni Budaya dan Prakarya', code: 'SBK', kktp: 75 },
      { name: 'Bahasa Sunda / Muatan Lokal', code: 'MULOK', kktp: 75 },
    ];
    const existingNames = new Set(
      cache.subjects.filter((m) => !m.id.startsWith('def_')).map((m) => m.name.toLowerCase())
    );
    const toInsert = standardSmp
      .filter((s) => !existingNames.has(s.name.toLowerCase()))
      .map((s, idx) => ({ id: `sub_${Date.now()}_${idx}`, code: s.code, name: s.name, kktp: s.kktp }));

    if (toInsert.length === 0) {
      showToast('Seluruh paket mata pelajaran standar SMP sudah tersedia!', 'info');
      return;
    }
    setLoading(true, `Menambahkan ${toInsert.length} mata pelajaran SMP...`);
    try {
      const sb = ensureSupabase();
      const { error } = await sb.from('cbt_subjects').insert(toInsert);
      if (error) throw error;
      await onSync();
      showToast(`${toInsert.length} mata pelajaran SMP berhasil ditambahkan!`, 'success');
    } catch (err) {
      showToast('Gagal menambahkan mapel: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clsName.trim()) return;
    setLoading(true, 'Menyimpan ke cbt_classes...');
    try {
      const sb = ensureSupabase();
      const { error } = await sb.from('cbt_classes').insert({
        id: 'cls_' + Date.now(),
        name: clsName.trim(),
        grade_level: clsGrade.trim(),
      });
      if (error) throw error;
      setClsName('');
      setClsGrade('');
      await onSync();
      showToast(`Kelas ${clsName} ditambahkan!`, 'success');
    } catch (err) {
      showToast('Gagal: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClass = async () => {
    if (!editingClass || !editingClass.name.trim()) return;
    setLoading(true, 'Memperbarui kelas...');
    try {
      const sb = ensureSupabase();
      const oldCls = cache.classes.find((c) => c.id === editingClass.id);
      const rowId = editingClass.id.startsWith('def_') ? 'cls_' + Date.now() : editingClass.id;
      const { error } = await sb.from('cbt_classes').upsert({
        id: rowId,
        name: editingClass.name.trim(),
        grade_level: editingClass.grade_level.trim(),
      });
      if (error) throw error;
      if (oldCls && oldCls.name !== editingClass.name.trim()) {
        await sb.from('cbt_students').update({ kelas: editingClass.name.trim() }).eq('kelas', oldCls.name);
      }
      setEditingClass(null);
      await onSync();
      showToast('Kelas diperbarui!', 'success');
    } catch (err) {
      showToast('Gagal: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rmName.trim()) return;
    setLoading(true, 'Menyimpan ke cbt_rooms...');
    try {
      const sb = ensureSupabase();
      const { error } = await sb.from('cbt_rooms').insert({
        id: 'rm_' + Date.now(),
        name: rmName.trim(),
        capacity: rmCap || 32,
        location: rmLoc.trim(),
        room_pin: rmPin.trim().toUpperCase(),
      });
      if (error) throw error;
      setRmName('');
      setRmCap(32);
      setRmLoc('');
      setRmPin('');
      await onSync();
      showToast(`Ruang ${rmName} ditambahkan!`, 'success');
    } catch (err) {
      showToast('Gagal: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRoom = async () => {
    if (!editingRoom || !editingRoom.name.trim()) return;
    setLoading(true, 'Memperbarui ruang...');
    try {
      const sb = ensureSupabase();
      const oldRm = cache.rooms.find((r) => r.id === editingRoom.id);
      const rowId = editingRoom.id.startsWith('def_') ? 'rm_' + Date.now() : editingRoom.id;
      const { error } = await sb.from('cbt_rooms').upsert({
        id: rowId,
        name: editingRoom.name.trim(),
        capacity: editingRoom.capacity || 32,
        location: editingRoom.location.trim(),
        room_pin: editingRoom.room_pin.trim().toUpperCase(),
      });
      if (error) throw error;
      if (oldRm && oldRm.name !== editingRoom.name.trim()) {
        await sb.from('cbt_students').update({ exam_room: editingRoom.name.trim() }).eq('exam_room', oldRm.name);
        await sb.from('cbt_teachers').update({ proctor_room: editingRoom.name.trim() }).eq('proctor_room', oldRm.name);
      }
      setEditingRoom(null);
      await onSync();
      showToast('Ruang ujian diperbarui!', 'success');
    } catch (err) {
      showToast('Gagal: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sesName.trim()) return;
    setLoading(true, 'Menyimpan ke cbt_sessions...');
    try {
      const sb = ensureSupabase();
      const { error } = await sb.from('cbt_sessions').insert({
        id: 'ses_' + Date.now(),
        name: sesName.trim(),
        time_range: sesTime.trim(),
      });
      if (error) throw error;
      setSesName('');
      setSesTime('');
      await onSync();
      showToast(`Sesi ${sesName} ditambahkan!`, 'success');
    } catch (err) {
      showToast('Gagal: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSession = async () => {
    if (!editingSession || !editingSession.name.trim()) return;
    setLoading(true, 'Memperbarui sesi...');
    try {
      const sb = ensureSupabase();
      const oldSes = cache.sessions.find((s) => s.id === editingSession.id);
      const rowId = editingSession.id.startsWith('def_') ? 'ses_' + Date.now() : editingSession.id;
      const { error } = await sb.from('cbt_sessions').upsert({
        id: rowId,
        name: editingSession.name.trim(),
        time_range: editingSession.time_range.trim(),
      });
      if (error) throw error;
      if (oldSes && oldSes.name !== editingSession.name.trim()) {
        await sb.from('cbt_students').update({ exam_session: editingSession.name.trim() }).eq('exam_session', oldSes.name);
      }
      setEditingSession(null);
      await onSync();
      showToast('Sesi ujian diperbarui!', 'success');
    } catch (err) {
      showToast('Gagal: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Plotting Massal */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md">
        <div className="mb-4">
          <span className="text-amber-300 text-xs font-bold uppercase tracking-wider">Alokasi Ruang &amp; Sesi Peserta</span>
          <h3 className="text-lg font-extrabold mt-1">Plotting Satu Kelas ke Ruang &amp; Sesi dalam 1 Klik</h3>
          <p className="text-xs text-indigo-200">
            Memindahkan seluruh siswa pada kelas tertentu ke ruang dan sesi ujian secara serentak.
          </p>
        </div>
        <form onSubmit={executeBulkAssign} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-indigo-200 mb-1">Pilih Kelas Sumber</label>
            <select
              value={bulkKelas}
              onChange={(e) => setBulkKelas(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white text-slate-900 text-xs font-bold outline-none"
            >
              {cache.classes.map((k) => (
                <option key={k.id} value={k.name}>
                  {k.name} ({cache.students.filter((s) => s.kelas === k.name).length} Siswa)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-indigo-200 mb-1">Tetapkan ke Ruang Ujian</label>
            <select
              value={bulkRuang}
              onChange={(e) => setBulkRuang(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white text-slate-900 text-xs font-bold outline-none"
            >
              {cache.rooms.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name} (Kap. {r.capacity || 32})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-indigo-200 mb-1">Tetapkan ke Sesi</label>
            <select
              value={bulkSesi}
              onChange={(e) => setBulkSesi(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white text-slate-900 text-xs font-bold outline-none"
            >
              {cache.sessions.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name} {s.time_range ? `(${s.time_range})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs shadow transition inline-flex items-center justify-center gap-1.5"
            >
              <Wand2 className="w-3.5 h-3.5" /> Terapkan Plotting Massal
            </button>
          </div>
        </form>
      </div>

      {/* 1. Mata Pelajaran */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </span>
            1. Daftar Mata Pelajaran ({cache.subjects.length})
          </h4>
          <button
            type="button"
            onClick={seedDefaultSmpSubjects}
            className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition inline-flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" /> Isi Paket Mapel SMP Standar
          </button>
        </div>

        <form onSubmit={handleSaveSubject} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="sm:col-span-5">
            <input
              type="text"
              required
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              placeholder="Nama Resmi Mapel (mis: Matematika)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold outline-none focus:border-purple-500"
            />
          </div>
          <div className="sm:col-span-3">
            <input
              type="text"
              value={subCode}
              onChange={(e) => setSubCode(e.target.value)}
              placeholder="Kode (mis: MTK)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold uppercase outline-none focus:border-purple-500"
            />
          </div>
          <div className="sm:col-span-2">
            <input
              type="number"
              min={1}
              max={100}
              value={subKktp}
              onChange={(e) => setSubKktp(parseInt(e.target.value, 10) || 75)}
              title="Nilai KKTP"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-center outline-none focus:border-purple-500"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full h-full py-2.5 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition"
            >
              + Tambah Mapel
            </button>
          </div>
        </form>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                <th className="py-2.5 px-3">Kode</th>
                <th className="py-2.5 px-3">Nama Mata Pelajaran</th>
                <th className="py-2.5 px-3 text-center">KKTP</th>
                <th className="py-2.5 px-3 text-center">Bank Soal</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cache.subjects.map((m) => {
                const qCnt = cache.questions.filter((q) => q.subject === m.name).length;
                return (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-extrabold text-purple-700">{m.code || '-'}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">{m.name}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-700 tabular-nums">{m.kktp || 75}</td>
                    <td className="py-2.5 px-3 text-center font-semibold text-slate-500 tabular-nums">{qCnt} Butir</td>
                    <td className="py-2.5 px-3 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => setEditingSubject({ ...m })}
                        className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteRecord('cbt_subjects', m.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2, 3, 4: Kelas, Ruang, Sesi */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kelas */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
            <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <LayoutGrid className="w-4 h-4" />
            </span>
            2. Daftar Kelas
          </h4>
          <form onSubmit={handleSaveClass} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={clsName}
                onChange={(e) => setClsName(e.target.value)}
                placeholder="Nama Kelas (mis: VIII C)"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold outline-none"
              />
              <button type="submit" className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0">
                + Tambah
              </button>
            </div>
            <input
              type="text"
              value={clsGrade}
              onChange={(e) => setClsGrade(e.target.value)}
              placeholder="Tingkat (mis: Tingkat VIII)"
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none"
            />
          </form>
          <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-72 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                  <th className="py-2 px-3">Kelas</th>
                  <th className="py-2 px-3 text-center">Siswa</th>
                  <th className="py-2 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cache.classes.map((k) => (
                  <tr key={k.id}>
                    <td className="py-2 px-3">
                      <p className="font-bold text-slate-800">{k.name}</p>
                      <p className="text-[10px] text-slate-400">{k.grade_level || '-'}</p>
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-indigo-600 tabular-nums">
                      {cache.students.filter((s) => s.kelas === k.name).length}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingClass({ ...k })}
                        className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteRecord('cbt_classes', k.id)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ruang */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
            <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
              <DoorOpen className="w-4 h-4" />
            </span>
            3. Daftar Ruang Ujian
          </h4>
          <form onSubmit={handleSaveRoom} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={rmName}
                onChange={(e) => setRmName(e.target.value)}
                placeholder="Nama Ruang (mis: Ruang 01)"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold outline-none"
              />
              <input
                type="number"
                min={1}
                max={200}
                value={rmCap}
                onChange={(e) => setRmCap(parseInt(e.target.value, 10) || 32)}
                title="Kapasitas"
                className="w-16 shrink-0 px-2 py-2 rounded-xl border border-slate-200 text-xs font-bold text-center outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={rmLoc}
                onChange={(e) => setRmLoc(e.target.value)}
                placeholder="Lokasi / Gedung"
                className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none"
              />
              <input
                type="text"
                value={rmPin}
                onChange={(e) => setRmPin(e.target.value)}
                placeholder="PIN (mis: R01-101)"
                className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs font-bold uppercase outline-none"
              />
            </div>
            <button type="submit" className="w-full py-2 px-3.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition shadow-sm">
              + Tambah Ruang Ujian
            </button>
          </form>
          <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-72 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                  <th className="py-2 px-3">Ruang &amp; PIN</th>
                  <th className="py-2 px-3 text-center">Kursi</th>
                  <th className="py-2 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cache.rooms.map((r) => {
                  const occ = cache.students.filter((s) => (s.exam_room || 'Ruang 01') === r.name).length;
                  return (
                    <tr key={r.id}>
                      <td className="py-2 px-3">
                        <p className="font-bold text-slate-800">{r.name}</p>
                        <span className="font-mono text-[10px] font-extrabold text-amber-800">PIN: {r.room_pin || '-'}</span>
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-sky-700 tabular-nums">
                        {occ}/{r.capacity || 32}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingRoom({ ...r })}
                          className="p-1 text-sky-600 hover:bg-sky-50 rounded"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRecord('cbt_rooms', r.id)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sesi */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
            <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </span>
            4. Daftar Sesi Ujian
          </h4>
          <form onSubmit={handleSaveSession} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={sesName}
                onChange={(e) => setSesName(e.target.value)}
                placeholder="Nama Sesi (mis: Sesi 3)"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold outline-none"
              />
              <button type="submit" className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0">
                + Tambah
              </button>
            </div>
            <input
              type="text"
              value={sesTime}
              onChange={(e) => setSesTime(e.target.value)}
              placeholder="Rentang Jam (mis: 13.00 - 15.00 WIB)"
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none"
            />
          </form>
          <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-72 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                  <th className="py-2 px-3">Sesi &amp; Jam</th>
                  <th className="py-2 px-3 text-center">Peserta</th>
                  <th className="py-2 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cache.sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 px-3">
                      <p className="font-bold text-slate-800">{s.name}</p>
                      <p className="text-[10px] text-slate-400">{s.time_range || '-'}</p>
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-700 tabular-nums">
                      {cache.students.filter((st) => (st.exam_session || 'Sesi 1') === s.name).length}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingSession({ ...s })}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteRecord('cbt_sessions', s.id)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Modals */}
      {editingSubject && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-800">Edit Mata Pelajaran</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={editingSubject.name}
                onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={editingSubject.code}
                  onChange={(e) => setEditingSubject({ ...editingSubject, code: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm uppercase font-bold"
                />
                <input
                  type="number"
                  value={editingSubject.kktp}
                  onChange={(e) => setEditingSubject({ ...editingSubject, kktp: parseInt(e.target.value, 10) || 75 })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingSubject(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Batal
              </button>
              <button type="button" onClick={handleUpdateSubject} className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {editingClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-800">Edit Kelas</h3>
            <input
              type="text"
              value={editingClass.name}
              onChange={(e) => setEditingClass({ ...editingClass, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
            />
            <input
              type="text"
              value={editingClass.grade_level}
              onChange={(e) => setEditingClass({ ...editingClass, grade_level: e.target.value })}
              placeholder="Tingkat"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingClass(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Batal
              </button>
              <button type="button" onClick={handleUpdateClass} className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {editingRoom && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-800">Edit Ruang Ujian</h3>
            <input
              type="text"
              value={editingRoom.name}
              onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={editingRoom.capacity}
                onChange={(e) => setEditingRoom({ ...editingRoom, capacity: parseInt(e.target.value, 10) || 32 })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
              />
              <input
                type="text"
                value={editingRoom.room_pin}
                onChange={(e) => setEditingRoom({ ...editingRoom, room_pin: e.target.value })}
                placeholder="PIN Ruang"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm uppercase font-bold"
              />
            </div>
            <input
              type="text"
              value={editingRoom.location}
              onChange={(e) => setEditingRoom({ ...editingRoom, location: e.target.value })}
              placeholder="Lokasi"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingRoom(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Batal
              </button>
              <button type="button" onClick={handleUpdateRoom} className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {editingSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-800">Edit Sesi Ujian</h3>
            <input
              type="text"
              value={editingSession.name}
              onChange={(e) => setEditingSession({ ...editingSession, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
            />
            <input
              type="text"
              value={editingSession.time_range}
              onChange={(e) => setEditingSession({ ...editingSession, time_range: e.target.value })}
              placeholder="Rentang Jam"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingSession(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Batal
              </button>
              <button type="button" onClick={handleUpdateSession} className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface BackupMigrationViewProps {
  cache: AppCache;
  onSync: () => Promise<void>;
  setLoading: (val: boolean, text?: string) => void;
  showToast: (msg: string, type?: ToastItem['type']) => void;
}

export const BackupMigrationView: React.FC<BackupMigrationViewProps> = ({
  cache,
  onSync,
  setLoading,
  showToast,
}) => {
  const downloadFullJsonBackup = () => {
    const blob = new Blob([JSON.stringify(cache, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup_EDU_CBT_v5_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('File backup JSON berhasil diunduh!', 'success');
  };

  const clearAllActiveSessions = async () => {
    setLoading(true, 'Membersihkan sesi aktif...');
    try {
      const sb = ensureSupabase();
      await sb.from('cbt_active_sessions').delete().neq('student_id', '');
      await onSync();
      showToast('Seluruh sesi aktif harian berhasil dibersihkan!', 'success');
    } catch (err) {
      showToast('Gagal: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <CloudDownload className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-slate-800 text-lg">Backup Seluruh Data (JSON)</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Unduh salinan lengkap data sekolah, akun siswa, guru, bank soal, jadwal ujian, dan rekap nilai dalam format JSON.
        </p>
        <button
          type="button"
          onClick={downloadFullJsonBackup}
          className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow transition inline-flex items-center gap-2"
        >
          <CloudDownload className="w-4 h-4" /> Unduh File Backup (.json)
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
          <Wand2 className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-slate-800 text-lg">Reset Sesi Aktif &amp; Bersihkan Cache</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Hapus seluruh sesi login aktif yang menggantung setelah pelaksanaan ujian harian selesai.
        </p>
        <button
          type="button"
          onClick={clearAllActiveSessions}
          className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shadow transition inline-flex items-center gap-2"
        >
          Bersihkan Sesi Aktif Harian
        </button>
      </div>
    </div>
  );
};
