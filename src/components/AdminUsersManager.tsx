import React, { useState } from 'react';
import {
  Edit3,
  FileSpreadsheet,
  GraduationCap,
  Save,
  Search,
  Shield,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import { ensureSupabase } from '../lib/supabase';
import {
  getOfficialSubjectNames,
  isIdentityTakenAcrossTables,
  isUsernameTakenAcrossTables,
} from '../lib/utils';
import type { AppCache, StaffRecord, StudentRecord, TeacherRecord, ToastItem } from '../types/cbt';

interface UsersManagerProps {
  cache: AppCache;
  onSync: () => Promise<void>;
  onDeleteRecord: (table: string, id: string) => void;
  setLoading: (val: boolean, text?: string) => void;
  showToast: (msg: string, type?: ToastItem['type']) => void;
}

export const StudentsManagerView: React.FC<UsersManagerProps> = ({
  cache,
  onSync,
  onDeleteRecord,
  setLoading,
  showToast,
}) => {
  const [name, setName] = useState('');
  const [nisn, setNisn] = useState('');
  const [kelas, setKelas] = useState(cache.classes[0]?.name || 'VII A');
  const [room, setRoom] = useState(cache.rooms[0]?.name || 'Ruang 01');
  const [session, setSession] = useState(cache.sessions[0]?.name || 'Sesi 1');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('123456');
  const [csvText, setCsvText] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<StudentRecord | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUsernameTakenAcrossTables(cache, username)) {
      showToast(`Username "${username}" sudah digunakan di tabel Siswa, Guru, atau Staf!`, 'error');
      return;
    }
    if (isIdentityTakenAcrossTables(cache, nisn)) {
      showToast(`NISN "${nisn}" sudah terdaftar di sistem!`, 'error');
      return;
    }
    setLoading(true, 'Menyimpan peserta ke cbt_students...');
    try {
      const sb = ensureSupabase();
      const { error } = await sb.from('cbt_students').insert({
        id: 'std_' + Date.now(),
        username: username.trim(),
        password: password.trim(),
        name: name.trim(),
        nisn: nisn.trim(),
        kelas,
        exam_room: room,
        exam_session: session,
      });
      if (error) throw error;
      setName('');
      setNisn('');
      setUsername('');
      setPassword('123456');
      await onSync();
      showToast(`Siswa ${name} berhasil ditambahkan!`, 'success');
    } catch (err) {
      showToast('Gagal menyimpan siswa: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    if (isUsernameTakenAcrossTables(cache, editing.username, editing.id)) {
      showToast(`Username "${editing.username}" sudah dipakai akun lain!`, 'error');
      return;
    }
    if (isIdentityTakenAcrossTables(cache, editing.nisn, editing.id)) {
      showToast(`NISN "${editing.nisn}" sudah dipakai akun lain!`, 'error');
      return;
    }
    setLoading(true, 'Memperbarui data siswa...');
    try {
      const sb = ensureSupabase();
      const { error } = await sb
        .from('cbt_students')
        .update({
          name: editing.name.trim(),
          nisn: editing.nisn.trim(),
          kelas: editing.kelas,
          exam_room: editing.exam_room,
          exam_session: editing.exam_session,
          username: editing.username.trim(),
          password: editing.password.trim(),
        })
        .eq('id', editing.id);
      if (error) throw error;
      setEditing(null);
      await onSync();
      showToast('Data siswa berhasil diperbarui!', 'success');
    } catch (err) {
      showToast('Gagal: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCsv = async () => {
    const raw = csvText.trim();
    if (!raw) {
      showToast('Tempel atau unggah data CSV siswa terlebih dahulu!', 'warning');
      return;
    }
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const defaultRoom = cache.rooms[0]?.name || 'Ruang 01';
    const defaultSession = cache.sessions[0]?.name || 'Sesi 1';
    const defaultClass = cache.classes[0]?.name || 'VII A';

    const seenUsernames = new Set<string>();
    const seenNisns = new Set<string>();
    const records: StudentRecord[] = [];
    let skipped = 0;

    lines.forEach((line, idx) => {
      const sep = line.includes(';') ? ';' : ',';
      const parts = line.split(sep).map((p) => p.trim().replace(/^"|"$/g, ''));
      if (parts.length < 3) {
        skipped++;
        return;
      }
      const [u, pwd, nm, ns, kls, rm, ses] = parts;
      if (!u || u.toLowerCase() === 'username') {
        skipped++;
        return;
      }
      const uKey = u.toLowerCase();
      const finalNisn = ns || '009' + Date.now().toString().slice(-6) + idx;
      const nKey = finalNisn.toLowerCase();
      if (
        isUsernameTakenAcrossTables(cache, u) ||
        seenUsernames.has(uKey) ||
        isIdentityTakenAcrossTables(cache, finalNisn) ||
        seenNisns.has(nKey)
      ) {
        skipped++;
        return;
      }
      seenUsernames.add(uKey);
      seenNisns.add(nKey);
      records.push({
        id: `std_bulk_${Date.now()}_${idx}`,
        username: u,
        password: pwd || '123456',
        name: nm || u,
        nisn: finalNisn,
        kelas: kls || defaultClass,
        exam_room: rm || defaultRoom,
        exam_session: ses || defaultSession,
      });
    });

    if (records.length === 0) {
      showToast(`Tidak ada baris valid baru untuk diimpor (${skipped} dilewati).`, 'warning');
      return;
    }

    setLoading(true, `Mengimpor ${records.length} siswa ke cbt_students...`);
    try {
      const sb = ensureSupabase();
      const { error } = await sb.from('cbt_students').insert(records);
      if (error) throw error;
      setCsvText('');
      await onSync();
      showToast(`${records.length} peserta berhasil diimpor!${skipped > 0 ? ` (${skipped} duplikat dilewati)` : ''}`, 'success');
    } catch (err) {
      showToast('Gagal impor CSV: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (cache.students.length === 0) {
      showToast('Belum ada data siswa untuk diekspor.', 'warning');
      return;
    }
    const headers = ['No', 'Nama Siswa', 'NISN', 'Kelas', 'Ruang Ujian', 'Sesi Ujian', 'Username', 'Password'];
    const rows = cache.students.map((s, idx) => [
      idx + 1,
      `"${String(s.name || '').replace(/"/g, '""')}"`,
      `"${s.nisn || ''}"`,
      `"${s.kelas || ''}"`,
      `"${s.exam_room || ''}"`,
      `"${s.exam_session || ''}"`,
      `"${s.username || ''}"`,
      `"${s.password || ''}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Daftar_Akun_Peserta_CBT_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('File CSV daftar akun & password peserta berhasil diunduh!', 'success');
  };

  const filtered = cache.students.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${u.name} ${u.nisn} ${u.kelas} ${u.exam_room} ${u.username}`.toLowerCase().includes(q);
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-indigo-600" /> Tambah Peserta / Siswa Baru
          </h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Nama Lengkap Siswa</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Ahmad Fauzan"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">NISN (Unik)</label>
                <input
                  type="text"
                  required
                  value={nisn}
                  onChange={(e) => setNisn(e.target.value)}
                  placeholder="0098123456"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Kelas</label>
                <select
                  value={kelas}
                  onChange={(e) => setKelas(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white outline-none"
                >
                  {cache.classes.map((k) => (
                    <option key={k.id} value={k.name}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Ruang Ujian</label>
                <select
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white outline-none"
                >
                  {cache.rooms.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Sesi Ujian</label>
                <select
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white outline-none"
                >
                  {cache.sessions.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Username Login</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="siswa_fauzan"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Kata Sandi</label>
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow transition inline-flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> Simpan Peserta Ujian
            </button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Impor Massal Siswa (CSV)
          </h3>
          <p className="text-xs text-slate-500">
            Format: <code className="bg-slate-100 px-1 rounded">username,password,nama,nisn,kelas,ruang,sesi</code>
          </p>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const r = new FileReader();
              r.onload = (ev) => setCsvText(String(ev.target?.result || ''));
              r.readAsText(file);
            }}
            className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700"
          />
          <textarea
            rows={4}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="fauzan01,123456,Ahmad Fauzan,0098112233,VII A,Ruang 01,Sesi 1"
            className="w-full p-3 rounded-xl border border-slate-200 font-mono text-xs outline-none"
          />
          <button
            type="button"
            onClick={handleBulkCsv}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow transition inline-flex items-center justify-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" /> Impor Data Siswa ke Cloud
          </button>
        </div>
      </div>

      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-slate-800">Daftar Peserta Terdaftar ({filtered.length})</h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama/NISN/kelas..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none"
              />
            </div>
            <button
              type="button"
              onClick={exportCsv}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold inline-flex items-center gap-1"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Ekspor CSV Akun
            </button>
          </div>
        </div>
        <div className="overflow-x-auto flex-1 max-h-[650px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="text-slate-500 text-xs uppercase border-b border-slate-200">
                <th className="py-3 px-4">Nama &amp; NISN</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4">Ruang &amp; Sesi</th>
                <th className="py-3 px-4">Akun &amp; Sandi</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-800">{u.name}</p>
                    <p className="text-xs text-slate-400 font-mono tabular-nums">NISN: {u.nisn}</p>
                  </td>
                  <td className="py-3 px-4 text-xs font-bold text-indigo-700">{u.kelas}</td>
                  <td className="py-3 px-4 text-xs">
                    <p className="font-bold text-slate-700">{u.exam_room || 'Ruang 01'}</p>
                    <p className="text-slate-400">{u.exam_session || 'Sesi 1'}</p>
                  </td>
                  <td className="py-3 px-4 text-xs font-mono">
                    <p className="font-bold text-slate-700">{u.username}</p>
                    <p className="text-rose-600 font-semibold">{u.password}</p>
                  </td>
                  <td className="py-3 px-4 text-right space-x-1">
                    <button
                      type="button"
                      onClick={() => setEditing({ ...u })}
                      className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteRecord('cbt_students', u.id)}
                      className="p-2 rounded-lg text-rose-500 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-800">Edit Peserta: {editing.name}</h3>
            <div className="space-y-3 text-left">
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={editing.nisn}
                  onChange={(e) => setEditing({ ...editing, nisn: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
                <select
                  value={editing.kelas}
                  onChange={(e) => setEditing({ ...editing, kelas: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  {cache.classes.map((k) => (
                    <option key={k.id} value={k.name}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={editing.exam_room}
                  onChange={(e) => setEditing({ ...editing, exam_room: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  {cache.rooms.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <select
                  value={editing.exam_session}
                  onChange={(e) => setEditing({ ...editing, exam_session: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  {cache.sessions.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={editing.username}
                  onChange={(e) => setEditing({ ...editing, username: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                />
                <input
                  type="text"
                  value={editing.password}
                  onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Batal
              </button>
              <button type="button" onClick={handleUpdate} className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white">
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const TeachersManagerView: React.FC<UsersManagerProps> = ({
  cache,
  onSync,
  onDeleteRecord,
  setLoading,
  showToast,
}) => {
  const subjectsList = getOfficialSubjectNames(cache);
  const [name, setName] = useState('');
  const [nip, setNip] = useState('');
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]);
  const [proctorRoom, setProctorRoom] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('guru123');
  const [editing, setEditing] = useState<(TeacherRecord & { newPassword?: string; subs?: string[] }) | null>(null);

  const toggleSub = (s: string) => {
    setSelectedSubs((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUsernameTakenAcrossTables(cache, username)) {
      showToast(`Username "${username}" sudah digunakan di tabel lain!`, 'error');
      return;
    }
    if (isIdentityTakenAcrossTables(cache, nip)) {
      showToast(`NIP "${nip}" sudah terdaftar di sistem!`, 'error');
      return;
    }
    setLoading(true, 'Menyimpan guru ke cbt_teachers...');
    try {
      const sb = ensureSupabase();
      const { error } = await sb.from('cbt_teachers').insert({
        id: 'tch_' + Date.now(),
        username: username.trim(),
        password: password.trim(),
        name: name.trim(),
        nip: nip.trim(),
        subject: selectedSubs.length > 0 ? selectedSubs.join(', ') : '-',
        proctor_room: proctorRoom,
      });
      if (error) throw error;
      setName('');
      setNip('');
      setSelectedSubs([]);
      setProctorRoom('');
      setUsername('');
      setPassword('guru123');
      await onSync();
      showToast(`Akun Guru ${name} berhasil disimpan!`, 'success');
    } catch (err) {
      showToast('Gagal: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    if (isUsernameTakenAcrossTables(cache, editing.username, editing.id)) {
      showToast(`Username "${editing.username}" sudah dipakai akun lain!`, 'error');
      return;
    }
    if (isIdentityTakenAcrossTables(cache, editing.nip, editing.id)) {
      showToast(`NIP "${editing.nip}" sudah dipakai akun lain!`, 'error');
      return;
    }
    setLoading(true, 'Memperbarui data guru...');
    try {
      const sb = ensureSupabase();
      const payload: Record<string, unknown> = {
        name: editing.name.trim(),
        nip: editing.nip.trim(),
        proctor_room: editing.proctor_room,
        subject: editing.subs && editing.subs.length > 0 ? editing.subs.join(', ') : '-',
        username: editing.username.trim(),
      };
      if (editing.newPassword?.trim()) payload.password = editing.newPassword.trim();
      const { error } = await sb.from('cbt_teachers').update(payload).eq('id', editing.id);
      if (error) throw error;
      setEditing(null);
      await onSync();
      showToast('Data guru berhasil diperbarui!', 'success');
    } catch (err) {
      showToast('Gagal: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-emerald-600" /> Tambah Guru / Pengawas Baru
          </h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama Lengkap & Gelar"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none"
            />
            <input
              type="text"
              required
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              placeholder="NIP / NUPTK"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none"
            />
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Mata Pelajaran Diampu</label>
              <div className="max-h-36 overflow-y-auto p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                {subjectsList.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSubs.includes(s)}
                      onChange={() => toggleSub(s)}
                      className="rounded text-emerald-600"
                    />
                    <span>{s}</span>
                  </label>
                ))}
              </div>
            </div>
            <select
              value={proctorRoom}
              onChange={(e) => setProctorRoom(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white outline-none"
            >
              <option value="">-- Tidak Ditugaskan Mengawas Ruang --</option>
              <option value="ALL">SEMUA RUANG (Koordinator Pengawas)</option>
              {cache.rooms.map((r) => (
                <option key={r.id} value={r.name}>
                  Pengawas {r.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username login"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none"
              />
              <input
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kata sandi"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow transition"
            >
              Simpan Akun Guru
            </button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Daftar Guru &amp; Pengawas ({cache.teachers.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                <th className="py-3 px-4">Nama Guru &amp; NIP</th>
                <th className="py-3 px-4">Mapel Diampu</th>
                <th className="py-3 px-4">Pengawas Ruang</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {cache.teachers.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-800">{t.name}</p>
                    <p className="text-xs text-slate-400 font-mono tabular-nums">NIP: {t.nip}</p>
                  </td>
                  <td className="py-3 px-4 text-xs font-semibold text-emerald-700">{t.subject}</td>
                  <td className="py-3 px-4 text-xs">
                    {t.proctor_room ? (
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold">{t.proctor_room}</span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs font-mono font-bold text-slate-700">{t.username}</td>
                  <td className="py-3 px-4 text-right space-x-1">
                    <button
                      type="button"
                      onClick={() => {
                        const subs = String(t.subject || '')
                          .split(',')
                          .map((s) => s.trim())
                          .filter((s) => s && s !== '-');
                        setEditing({ ...t, subs, newPassword: '' });
                      }}
                      className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteRecord('cbt_teachers', t.id)}
                      className="p-2 rounded-lg text-rose-500 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-3">
            <h3 className="font-bold text-slate-800">Edit Guru: {editing.name}</h3>
            <input
              type="text"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={editing.nip}
                onChange={(e) => setEditing({ ...editing, nip: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
              <select
                value={editing.proctor_room}
                onChange={(e) => setEditing({ ...editing, proctor_room: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="">-- Tidak Ada --</option>
                <option value="ALL">SEMUA RUANG</option>
                {cache.rooms.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="max-h-32 overflow-y-auto p-2.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              {subjectsList.map((s) => (
                <label key={s} className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(editing.subs?.includes(s))}
                    onChange={() =>
                      setEditing({
                        ...editing,
                        subs: editing.subs?.includes(s)
                          ? editing.subs.filter((x) => x !== s)
                          : [...(editing.subs || []), s],
                      })
                    }
                  />
                  <span>{s}</span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={editing.username}
                onChange={(e) => setEditing({ ...editing, username: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
              />
              <input
                type="text"
                value={editing.newPassword || ''}
                onChange={(e) => setEditing({ ...editing, newPassword: e.target.value })}
                placeholder="Reset sandi (opsional)"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Batal
              </button>
              <button type="button" onClick={handleUpdate} className="px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white">
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const StaffManagerView: React.FC<UsersManagerProps> = ({
  cache,
  onSync,
  onDeleteRecord,
  setLoading,
  showToast,
}) => {
  const [role, setRole] = useState<'admin' | 'kepsek'>('kepsek');
  const [name, setName] = useState('');
  const [nip, setNip] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('kepsek123');
  const [editing, setEditing] = useState<(StaffRecord & { newPassword?: string }) | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUsernameTakenAcrossTables(cache, username)) {
      showToast(`Username "${username}" sudah digunakan di tabel lain!`, 'error');
      return;
    }
    if (isIdentityTakenAcrossTables(cache, nip)) {
      showToast(`NIP "${nip}" sudah terdaftar di sistem!`, 'error');
      return;
    }
    setLoading(true, 'Menyimpan ke cbt_staff...');
    try {
      const sb = ensureSupabase();
      const { error } = await sb.from('cbt_staff').insert({
        id: 'stf_' + Date.now(),
        username: username.trim(),
        password: password.trim(),
        role,
        name: name.trim(),
        nip: nip.trim(),
      });
      if (error) throw error;
      setName('');
      setNip('');
      setUsername('');
      await onSync();
      showToast(`Akun ${role === 'kepsek' ? 'Kepala Sekolah' : 'Administrator'} berhasil disimpan!`, 'success');
    } catch (err) {
      showToast('Gagal: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    if (isUsernameTakenAcrossTables(cache, editing.username, editing.id)) {
      showToast(`Username "${editing.username}" sudah dipakai akun lain!`, 'error');
      return;
    }
    if (isIdentityTakenAcrossTables(cache, editing.nip, editing.id)) {
      showToast(`NIP "${editing.nip}" sudah dipakai akun lain!`, 'error');
      return;
    }
    setLoading(true, 'Memperbarui cbt_staff...');
    try {
      const sb = ensureSupabase();
      const payload: Record<string, unknown> = {
        role: editing.role,
        name: editing.name.trim(),
        nip: editing.nip.trim(),
        username: editing.username.trim(),
      };
      if (editing.newPassword?.trim()) payload.password = editing.newPassword.trim();
      const { error } = await sb.from('cbt_staff').update(payload).eq('id', editing.id);
      if (error) throw error;
      setEditing(null);
      await onSync();
      showToast('Akun staf pimpinan diperbarui!', 'success');
    } catch (err) {
      showToast('Gagal: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" /> Tambah Akun Admin / Kepala Sekolah
          </h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'kepsek')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-white outline-none"
            >
              <option value="kepsek">Kepala Sekolah (Supervisi &amp; Laporan)</option>
              <option value="admin">Administrator Sistem (Akses Penuh)</option>
            </select>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama Lengkap & Gelar"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none"
            />
            <input
              type="text"
              required
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              placeholder="NIP"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none"
              />
              <input
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kata Sandi"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow transition"
            >
              Simpan Akun Staf Pimpinan
            </button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Daftar Admin &amp; Kepala Sekolah ({cache.staff.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                <th className="py-3 px-4">Nama &amp; NIP</th>
                <th className="py-3 px-4">Peran</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {cache.staff.map((st) => (
                <tr key={st.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-800">{st.name}</p>
                    <p className="text-xs text-slate-400 font-mono tabular-nums">NIP: {st.nip}</p>
                  </td>
                  <td className="py-3 px-4 text-xs font-bold uppercase text-purple-700">
                    {st.role === 'kepsek' ? 'Kepala Sekolah' : 'Administrator'}
                  </td>
                  <td className="py-3 px-4 text-xs font-mono font-bold text-slate-700">{st.username}</td>
                  <td className="py-3 px-4 text-right space-x-1">
                    <button
                      type="button"
                      onClick={() => setEditing({ ...st, newPassword: '' })}
                      className="p-2 rounded-lg text-purple-600 hover:bg-purple-50"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {st.id !== 'stf_admin_default' && (
                      <button
                        type="button"
                        onClick={() => onDeleteRecord('cbt_staff', st.id)}
                        className="p-2 rounded-lg text-rose-500 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-3">
            <h3 className="font-bold text-slate-800">Edit Akun: {editing.name}</h3>
            <select
              value={editing.role}
              onChange={(e) => setEditing({ ...editing, role: e.target.value as 'admin' | 'kepsek' })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white font-bold"
            >
              <option value="admin">Administrator Sistem</option>
              <option value="kepsek">Kepala Sekolah</option>
            </select>
            <input
              type="text"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
            />
            <input
              type="text"
              value={editing.nip}
              onChange={(e) => setEditing({ ...editing, nip: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={editing.username}
                onChange={(e) => setEditing({ ...editing, username: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
              />
              <input
                type="text"
                value={editing.newPassword || ''}
                onChange={(e) => setEditing({ ...editing, newPassword: e.target.value })}
                placeholder="Reset sandi (opsional)"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Batal
              </button>
              <button type="button" onClick={handleUpdate} className="px-5 py-2 rounded-xl text-sm font-semibold bg-purple-600 text-white">
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
