import type { ActiveSession, AppCache, UserSession, ViolationLog } from '../types/cbt';

// Web Audio API siren helpers
let supervisorAudioCtx: AudioContext | null = null;
let supervisorSirenInterval: ReturnType<typeof setInterval> | null = null;
let studentSirenInterval: ReturnType<typeof setInterval> | null = null;

export function unlockSupervisorAudioContext() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!supervisorAudioCtx) {
      supervisorAudioCtx = new AudioCtx();
    }
    if (supervisorAudioCtx.state === 'suspended') {
      supervisorAudioCtx.resume().catch(() => {});
    }
  } catch {
    // Ignore audio context restriction
  }
}

export function playSupervisorSirenPulse(isMuted: boolean) {
  if (isMuted) return;
  try {
    unlockSupervisorAudioContext();
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = supervisorAudioCtx || new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(780, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1080, ctx.currentTime + 0.25);
    osc.frequency.linearRampToValueAtTime(680, ctx.currentTime + 0.55);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.02, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.62);
  } catch {
    // Ignore audio errors
  }
}

export function startSupervisorSiren(isMuted: boolean) {
  if (isMuted || supervisorSirenInterval) return;
  playSupervisorSirenPulse(isMuted);
  supervisorSirenInterval = setInterval(() => {
    playSupervisorSirenPulse(isMuted);
  }, 850);
}

export function stopSupervisorSiren() {
  if (supervisorSirenInterval) {
    clearInterval(supervisorSirenInterval);
    supervisorSirenInterval = null;
  }
}

export function startStudentSiren() {
  if (studentSirenInterval) return;
  const beep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1180, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.56);
    } catch {
      // Ignore audio errors
    }
  };
  beep();
  studentSirenInterval = setInterval(beep, 750);
}

export function stopStudentSiren() {
  if (studentSirenInterval) {
    clearInterval(studentSirenInterval);
    studentSirenInterval = null;
  }
}

export function generateRandomToken(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = '';
  for (let i = 0; i < length; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function formatDateTimeIndo(isoStr?: string | null): string {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return String(isoStr);
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function toLocalDatetimeInputValue(isoStr?: string | null): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isSubjectAllowedForUser(user: UserSession | null, subjectName: string): boolean {
  if (!user || user.role !== 'guru') return true;
  const assigned = String(user.subject || '').trim();
  if (!assigned || assigned === '-') return false;
  const target = String(subjectName || '').trim().toLowerCase();
  return assigned
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .includes(target);
}

export function getOfficialSubjectNames(cache: AppCache): string[] {
  const fromSubjects = cache.subjects.map((m) => m.name);
  const fromLegacy = [
    ...cache.questions.map((q) => q.subject),
    ...cache.exams.map((e) => e.subject),
  ];
  return [...new Set([...fromSubjects, ...fromLegacy])].filter(Boolean).sort();
}

export function doesSessionMatchRoom(sessionRow: ActiveSession, roomFilter?: string | null): boolean {
  if (!roomFilter || roomFilter === 'ALL') return true;
  return String(sessionRow?.exam_room || '').trim().toLowerCase() === String(roomFilter).trim().toLowerCase();
}

export function resolveViolationReason(sessionRow: ActiveSession, logs: ViolationLog[]): string {
  if (!sessionRow) return 'Terdeteksi pelanggaran tata tertib ujian';
  if (sessionRow.saved_answers && typeof sessionRow.saved_answers === 'object' && sessionRow.saved_answers.last_violation_reason) {
    return String(sessionRow.saved_answers.last_violation_reason);
  }
  const matchedLog = logs.find((l) => l.student_id === sessionRow.student_id);
  if (matchedLog && matchedLog.reason) return matchedLog.reason;
  if (sessionRow.status === 'TERKUNCI_PELANGGARAN') {
    return 'Melewati batas maksimal pelanggaran ujian';
  }
  return 'Keluar dari mode layar penuh / berpindah tab ujian';
}

export function getUnifiedViolationRecords(cache: AppCache): ViolationLog[] {
  const logs = cache.violationLogs || [];
  const activeViol = (cache.activeSessions || []).filter(
    (s) => Number(s.violations || 0) > 0 || s.status === 'TERKUNCI_PELANGGARAN'
  );
  const combined = [...logs];

  activeViol.forEach((s) => {
    const alreadyInLogs = logs.some(
      (l) => l.student_id === s.student_id && Number(l.violation_count) >= Number(s.violations)
    );
    if (!alreadyInLogs) {
      combined.unshift({
        id: `live_${s.student_id}`,
        student_id: s.student_id,
        student_name: s.student_name,
        student_identity: s.student_identity,
        student_class: s.student_class,
        exam_room: s.exam_room || 'Ruang 01',
        exam_id: '',
        exam_title: s.exam_title || '-',
        subject: '-',
        reason: resolveViolationReason(s, logs),
        violation_count: Number(s.violations || 1),
        created_at: s.last_seen || new Date().toISOString(),
      });
    }
  });
  return combined;
}

export function isUsernameTakenAcrossTables(cache: AppCache, username: string, ignoreId?: string): boolean {
  const target = String(username || '').trim().toLowerCase();
  if (!target) return false;
  return (
    cache.students.some((u) => u.id !== ignoreId && String(u.username || '').trim().toLowerCase() === target) ||
    cache.teachers.some((u) => u.id !== ignoreId && String(u.username || '').trim().toLowerCase() === target) ||
    cache.staff.some((u) => u.id !== ignoreId && String(u.username || '').trim().toLowerCase() === target)
  );
}

export function isIdentityTakenAcrossTables(cache: AppCache, identity: string, ignoreId?: string): boolean {
  const target = String(identity || '').trim().toLowerCase();
  if (!target || target === '-') return false;
  return (
    cache.students.some((u) => u.id !== ignoreId && String(u.nisn || '').trim().toLowerCase() === target) ||
    cache.teachers.some((u) => u.id !== ignoreId && String(u.nip || '').trim().toLowerCase() === target) ||
    cache.staff.some((u) => u.id !== ignoreId && String(u.nip || '').trim().toLowerCase() === target)
  );
}

export const SESSION_STORAGE_KEY = 'cbt_v50_session';
export const STUDENT_SESSION_BACKUP_KEY = 'cbt_v50_student_session_backup';

export function getSavedSession(): UserSession | null {
  try {
    const tabSession = JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY) || 'null') as UserSession | null;
    if (tabSession) return tabSession;
    const studentRecovery = JSON.parse(localStorage.getItem(STUDENT_SESSION_BACKUP_KEY) || 'null') as UserSession | null;
    if (studentRecovery && studentRecovery.role === 'siswa') {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(studentRecovery));
      return studentRecovery;
    }
    return null;
  } catch {
    return null;
  }
}

export function persistSession(user: UserSession | null) {
  try {
    if (!user) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(STUDENT_SESSION_BACKUP_KEY);
    } else {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
      if (user.role === 'siswa') {
        localStorage.setItem(STUDENT_SESSION_BACKUP_KEY, JSON.stringify(user));
      }
    }
  } catch {
    // Ignore storage error
  }
}
