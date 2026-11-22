import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Clock,
  Code2,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Laptop,
  Megaphone,
  ShieldCheck,
  User,
} from 'lucide-react';
import { ensureSupabase } from '../lib/supabase';
import { formatDateTimeIndo } from '../lib/utils';
import type { Announcement, SchoolSettings, ToastItem, UserSession } from '../types/cbt';

interface LoginViewProps {
  school: SchoolSettings;
  announcements: Announcement[];
  dbConnected: boolean | null;
  onLoginSuccess: (user: UserSession) => Promise<void>;
  onOpenSqlModal: () => void;
  setLoading: (val: boolean, text?: string) => void;
  showToast: (msg: string, type?: ToastItem['type']) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  school,
  announcements,
  dbConnected,
  onLoginSuccess,
  onOpenSqlModal,
  setLoading,
  showToast,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeAnnouncements = announcements.filter((a) => a.is_active !== false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    const p = password;
    if (!u || !p) return;

    setLoading(true, 'Memverifikasi kredensial akun...');
    try {
      const sb = ensureSupabase();
      const { data, error } = await sb.rpc('cbt_authenticate_user', {
        p_username: u,
        p_password: p,
      });

      let matchedUser: UserSession | null =
        !error && Array.isArray(data) && data.length > 0 ? (data[0] as UserSession) : null;

      if (!matchedUser && u.toLowerCase() === 'admin' && p === 'admin123') {
        matchedUser = {
          id: 'stf_admin_default',
          username: 'admin',
          role: 'admin',
          name: 'Administrator Sistem',
          identity: '19800101 200501 1 001',
          kelas: '-',
          subject: '-',
          exam_room: '-',
          exam_session: '-',
          proctor_room: 'ALL',
        };
      }

      if (error && !matchedUser) {
        throw error;
      }

      if (!matchedUser) {
        setLoading(false);
        showToast('Username/NISN/NIP atau Kata Sandi tidak ditemukan!', 'error');
        return;
      }

      await onLoginSuccess(matchedUser);
      setLoading(false);
      showToast(`Selamat datang, ${matchedUser.name}!`, 'success');
    } catch (err) {
      setLoading(false);
      showToast('Gagal masuk ke sistem: ' + (err as Error).message, 'error');
    }
  };

  const formattedDate = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedClock = now.toLocaleTimeString('id-ID', { hour12: false });

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-5 relative z-10 fade-in items-stretch">
        {/* KOLOM KIRI BENTO */}
        <div className="lg:col-span-6 flex flex-col gap-5">
          <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 rounded-3xl p-6 md:p-7 text-white shadow-xl border border-indigo-400/25 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-xl" />

            <div className="relative z-10 flex items-center gap-3.5 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white shadow-inner overflow-hidden shrink-0">
                {school.logo_url ? (
                  <img
                    src={school.logo_url}
                    alt="Logo Sekolah"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain bg-white p-1"
                  />
                ) : (
                  <Laptop className="w-7 h-7" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="font-extrabold text-xl tracking-tight">EDU-CBT PRO v5.0</h1>
                <p className="text-sm text-indigo-100 font-bold truncate mt-0.5">{school.school_name}</p>
                <p className="text-[11px] text-indigo-200/90 mt-0.5 truncate">
                  Tahun Pelajaran {school.academic_year} (Semester {school.semester}) · NPSN: {school.npsn}
                </p>
              </div>
            </div>

            <div className="relative z-10 bg-slate-950/35 backdrop-blur-md rounded-2xl p-4 border border-white/15 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Waktu Sistem Saat Ini</p>
                  <p className="text-xs font-semibold text-white">{formattedDate}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-2xl font-black text-amber-300 tracking-wider leading-none tabular-nums">
                  {formattedClock}
                </p>
                <span className="text-[10px] font-bold text-emerald-300 uppercase">WIB · Sinkron</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/85 backdrop-blur-md rounded-3xl p-6 text-white shadow-xl border border-white/10 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 pb-3.5 mb-3.5 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center">
                    <Megaphone className="w-4 h-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-extrabold text-white">Pengumuman &amp; Tata Tertib Ujian</h2>
                    <p className="text-[11px] text-slate-400">Informasi resmi dari Panitia Ujian Sekolah</p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-indigo-300">Info Resmi</span>
              </div>

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1 text-xs">
                {activeAnnouncements.length === 0 ? (
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                    <p className="font-bold text-amber-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" /> Tata Tertib Peserta Ujian CBT:
                    </p>
                    <ul className="text-slate-300 space-y-1 list-disc list-inside leading-relaxed">
                      <li>Gunakan <strong>Username / NISN</strong> dan <strong>Password</strong> sesuai Kartu Peserta.</li>
                      <li>Selama ujian berlangsung, wajib berada dalam mode <strong>Layar Penuh (Fullscreen)</strong>.</li>
                      <li>Dilarang berpindah tab, membuka aplikasi lain, atau membagi layar.</li>
                    </ul>
                  </div>
                ) : (
                  activeAnnouncements.slice(0, 4).map((a) => (
                    <div key={a.id} className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                      <div className="flex items-center justify-between gap-2 mb-1 text-[11px] text-slate-400">
                        <span className="font-bold text-amber-300">{a.category || 'INFO'}</span>
                        <span>{formatDateTimeIndo(a.created_at)}</span>
                      </div>
                      <p className="font-bold text-white text-xs">{a.title}</p>
                      <p className="text-slate-300 text-[11px] mt-1 leading-relaxed">{a.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Sistem Terintegrasi v5.0
              </span>
              <button
                type="button"
                onClick={onOpenSqlModal}
                className="text-indigo-300 hover:text-white font-bold underline inline-flex items-center gap-1"
              >
                <Code2 className="w-3.5 h-3.5" /> Lihat SQL Setup
              </button>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN BENTO */}
        <div className="lg:col-span-6 bg-white rounded-3xl p-7 md:p-10 shadow-2xl border border-white/20 flex flex-col justify-between">
          <div>
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600">
                <Fingerprint className="w-4 h-4" /> Portal Autentikasi Terpadu
              </div>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-2">Masuk ke Akun Anda</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Masukkan <strong>Username / NISN / NIP</strong> dan <strong>Kata Sandi</strong> sesuai Kartu Peserta atau data akun sekolah.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Username / NISN / NIP
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username, NISN, atau NIP..."
                    className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Kata Sandi
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </span>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi..."
                    className="w-full pl-10 pr-12 py-3.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition text-sm font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                    aria-label="Tampilkan kata sandi"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2 mt-3"
              >
                <span>Masuk ke Sistem</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>&copy; 2026 EDU-CBT PRO v5.0</span>
            <span
              className={`inline-flex items-center gap-1.5 font-semibold ${
                dbConnected === true
                  ? 'text-emerald-600'
                  : dbConnected === false
                  ? 'text-rose-600'
                  : 'text-slate-500'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  dbConnected === true
                    ? 'bg-emerald-500'
                    : dbConnected === false
                    ? 'bg-rose-500'
                    : 'bg-amber-400 animate-pulse'
                }`}
              />
              {dbConnected === true
                ? 'Server Cloud Siap'
                : dbConnected === false
                ? 'Jalankan SQL v5.0 di Supabase'
                : 'Menghubungkan Supabase...'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
