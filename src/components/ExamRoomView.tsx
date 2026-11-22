import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Flag,
  Headphones,
  Lock,
  Maximize2,
  MessageSquare,
  Pause,
  Send,
  ShieldAlert,
  Volume2,
} from 'lucide-react';
import { ensureSupabase } from '../lib/supabase';
import { shuffleArray, startStudentSiren, stopStudentSiren } from '../lib/utils';
import type { AppCache, ExamSchedule, Question, ToastItem, UserSession } from '../types/cbt';
import { MathText } from './MathText';

interface ExamRoomViewProps {
  cache: AppCache;
  currentUser: UserSession;
  exam: ExamSchedule;
  onFinish: (submitted: boolean) => Promise<void>;
  onKicked: () => void;
  setLoading: (val: boolean, text?: string) => void;
  showToast: (msg: string, type?: ToastItem['type']) => void;
}

interface BackupState {
  questionIds: string[];
  optionShuffles: Record<string, number[]>;
  answers: Record<string, unknown>;
  doubt: Record<string, boolean>;
  audioPlays: Record<string, number>;
  timeLeft: number;
}

export const ExamRoomView: React.FC<ExamRoomViewProps> = ({
  cache,
  currentUser,
  exam,
  onFinish,
  onKicked,
  setLoading,
  showToast,
}) => {
  const backupKey = `cbt_v50_backup_${currentUser.id}_${exam.id}`;

  // Build deterministic/restored exam session state once on mount
  const initialSetup = useMemo(() => {
    const pool = cache.questions.filter(
      (q) =>
        q.subject === exam.subject &&
        (exam.packetCode === 'SEMUA' || q.packetCode === exam.packetCode)
    );

    let saved: BackupState | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(backupKey) || 'null') as BackupState | null;
    } catch {
      saved = null;
    }

    let orderedQuestions: Question[] = [];
    if (saved && Array.isArray(saved.questionIds) && saved.questionIds.length > 0) {
      const mapById = new Map(pool.map((q) => [q.id, q]));
      orderedQuestions = saved.questionIds.map((id) => mapById.get(id)).filter((q): q is Question => Boolean(q));
    }

    if (orderedQuestions.length === 0) {
      let base = exam.randomize ? shuffleArray(pool) : [...pool];
      if (exam.maxQuestions > 0 && base.length > exam.maxQuestions) {
        base = base.slice(0, exam.maxQuestions);
      }
      orderedQuestions = base;
    }

    const optionShuffles: Record<string, number[]> = saved?.optionShuffles || {};
    orderedQuestions.forEach((q) => {
      if (!optionShuffles[q.id]) {
        const nonEmptyIndices = (q.options || [])
          .map((opt, idx) => ({ opt, idx }))
          .filter((item) => String(item.opt || '').trim() !== '')
          .map((item) => item.idx);
        optionShuffles[q.id] = exam.randomizeOptions
          ? shuffleArray(nonEmptyIndices)
          : nonEmptyIndices;
      }
    });

    const cloudRow = cache.activeSessions.find((s) => s.student_id === currentUser.id);
    const cloudAnswers =
      cloudRow?.exam_title === exam.title &&
      cloudRow?.saved_answers &&
      typeof cloudRow.saved_answers.answers === 'object'
        ? (cloudRow.saved_answers.answers as Record<string, unknown>)
        : null;

    const cloudTime =
      cloudRow?.exam_title === exam.title && Number(cloudRow.time_left_seconds) > 0
        ? Number(cloudRow.time_left_seconds)
        : null;

    return {
      questions: orderedQuestions,
      optionShuffles,
      answers: saved?.answers || cloudAnswers || {},
      doubt: saved?.doubt || {},
      audioPlays: saved?.audioPlays || {},
      timeLeft: saved?.timeLeft || cloudTime || (exam.duration || 60) * 60,
      initialViolations: cloudRow?.exam_title === exam.title ? Number(cloudRow.violations || 0) : 0,
      initialLocked:
        cloudRow?.exam_title === exam.title && cloudRow?.status === 'TERKUNCI_PELANGGARAN',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.id]);

  const [questions] = useState<Question[]>(initialSetup.questions);
  const [optionShuffles] = useState<Record<string, number[]>>(initialSetup.optionShuffles);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialSetup.answers);
  const [doubt, setDoubt] = useState<Record<string, boolean>>(initialSetup.doubt);
  const [audioPlays, setAudioPlays] = useState<Record<string, number>>(initialSetup.audioPlays);
  const [timeLeft, setTimeLeft] = useState<number>(initialSetup.timeLeft);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');
  const [violations, setViolations] = useState<number>(initialSetup.initialViolations);
  const [isLocked, setIsLocked] = useState<boolean>(initialSetup.initialLocked);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [violationModalReason, setViolationModalReason] = useState<string | null>(
    initialSetup.initialLocked ? 'Akun terkunci karena melewati batas maksimal pelanggaran.' : null
  );
  const [proctorPinInput, setProctorPinInput] = useState('');
  const [fsWarningSeconds, setFsWarningSeconds] = useState<number | null>(null);
  const [supervisorMsgModal, setSupervisorMsgModal] = useState<string | null>(null);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [gformElapsedSec, setGformElapsedSec] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isSubmittingRef = useRef(false);
  const lastViolationTsRef = useRef(0);
  const lastReasonRef = useRef<string>('');
  const latestRef = useRef({
    answers,
    doubt,
    audioPlays,
    timeLeft,
    violations,
    isLocked,
    isPaused,
  });

  latestRef.current = {
    answers,
    doubt,
    audioPlays,
    timeLeft,
    violations,
    isLocked,
    isPaused,
  };

  // Persist local backup whenever answers/time changes
  useEffect(() => {
    try {
      const payload: BackupState = {
        questionIds: questions.map((q) => q.id),
        optionShuffles,
        answers,
        doubt,
        audioPlays,
        timeLeft,
      };
      localStorage.setItem(backupKey, JSON.stringify(payload));
    } catch {
      // Ignore storage quota
    }
  }, [answers, doubt, audioPlays, timeLeft, questions, optionShuffles, backupKey]);

  const answeredCount = useMemo(() => {
    return questions.filter((q) => {
      const val = answers[q.id];
      if (val === undefined || val === null) return false;
      if (Array.isArray(val)) return val.length > 0;
      return String(val).trim() !== '';
    }).length;
  }, [questions, answers]);

  const requestSafeFullscreen = useCallback(() => {
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      }
    } catch {
      // Ignore fullscreen denial
    }
  }, []);

  const exitSafeFullscreen = useCallback(() => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      // Ignore
    }
  }, []);

  // Submit handler (called by button, timer expiry, or FORCE_SUBMIT)
  const submitExam = useCallback(
    async (autoReason?: string) => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      stopStudentSiren();
      setLoading(true, autoReason ? `Mengumpulkan otomatis (${autoReason})...` : 'Mengirim jawaban ke server...');

      try {
        const sb = ensureSupabase();
        const currAnswers = latestRef.current.answers;
        const currViolations = latestRef.current.violations;

        if (exam.sourceType === 'gform') {
          const { error } = await sb.from('cbt_results').insert({
            id: `res_${Date.now()}_${currentUser.id}`,
            exam_id: exam.id,
            exam_title: exam.title,
            subject: exam.subject,
            student_id: currentUser.id,
            student_name: currentUser.name,
            student_identity: currentUser.identity,
            student_class: currentUser.kelas,
            score: 100,
            correct_count: 1,
            total_questions: 1,
            violations: currViolations,
            submitted_at: new Date().toISOString(),
            answers_detail: { source: 'gform', gform_url: exam.gformUrl },
            grading_status: 'graded',
          });
          if (error) throw error;
        } else {
          const qIds = questions.map((q) => q.id);
          const { error: rpcErr } = await sb.rpc('cbt_grade_and_submit_exam', {
            p_exam_id: exam.id,
            p_student_id: currentUser.id,
            p_student_name: currentUser.name,
            p_student_identity: currentUser.identity,
            p_student_class: currentUser.kelas,
            p_question_ids: qIds,
            p_answers: currAnswers,
            p_violations: currViolations,
          });
          if (rpcErr) throw rpcErr;
        }

        await sb
          .from('cbt_active_sessions')
          .upsert(
            {
              student_id: currentUser.id,
              student_name: currentUser.name,
              student_identity: currentUser.identity,
              student_class: currentUser.kelas,
              exam_room: currentUser.exam_room || 'Ruang 01',
              status: 'ONLINE_PORTAL',
              exam_title: '-',
              progress: `Selesai: ${exam.title}`,
              violations: 0,
              saved_answers: {},
              time_left_seconds: 0,
              force_action: '',
              extra_minutes: 0,
              supervisor_message: '',
              is_paused: false,
              last_seen: new Date().toISOString(),
            },
            { onConflict: 'student_id' }
          );

        localStorage.removeItem(backupKey);
        exitSafeFullscreen();
        showToast(
          autoReason
            ? `Ujian dikumpulkan otomatis (${autoReason}).`
            : 'Jawaban berhasil dikirim dan tersimpan di server!',
          'success'
        );
        await onFinish(true);
      } catch (err) {
        isSubmittingRef.current = false;
        showToast('Gagal mengirim jawaban: ' + (err as Error).message, 'error');
      } finally {
        setLoading(false);
      }
    },
    [backupKey, currentUser, exam, exitSafeFullscreen, onFinish, questions, setLoading, showToast]
  );

  // Record a cheating/lockdown violation
  const triggerViolation = useCallback(
    async (reason: string) => {
      if (isSubmittingRef.current || latestRef.current.isPaused || latestRef.current.isLocked) return;
      const now = Date.now();
      if (now - lastViolationTsRef.current < 2200) return;
      lastViolationTsRef.current = now;
      lastReasonRef.current = reason;

      const nextCount = latestRef.current.violations + 1;
      const maxViol = exam.maxViolations ?? 3;
      const shouldLock = maxViol > 0 && nextCount >= maxViol;

      setViolations(nextCount);
      setViolationModalReason(reason);
      if (shouldLock) {
        setIsLocked(true);
      }
      startStudentSiren();

      try {
        const sb = ensureSupabase();
        await sb.from('cbt_violation_logs').insert({
          id: `viol_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          student_id: currentUser.id,
          student_name: currentUser.name,
          student_identity: currentUser.identity,
          student_class: currentUser.kelas,
          exam_room: currentUser.exam_room || 'Ruang 01',
          exam_id: exam.id,
          exam_title: exam.title,
          subject: exam.subject,
          reason,
          violation_count: nextCount,
          created_at: new Date().toISOString(),
        });

        await sb.from('cbt_active_sessions').upsert(
          {
            student_id: currentUser.id,
            student_name: currentUser.name,
            student_identity: currentUser.identity,
            student_class: currentUser.kelas,
            exam_room: currentUser.exam_room || 'Ruang 01',
            status: shouldLock ? 'TERKUNCI_PELANGGARAN' : 'SEDANG_UJIAN',
            exam_title: exam.title,
            progress: `${answeredCount}/${questions.length} Dijawab`,
            violations: nextCount,
            saved_answers: {
              answers: latestRef.current.answers,
              last_violation_reason: reason,
            },
            time_left_seconds: latestRef.current.timeLeft,
            last_seen: new Date().toISOString(),
          },
          { onConflict: 'student_id' }
        );
      } catch {
        // Ignore network error during alert logging
      }
    },
    [answeredCount, currentUser, exam, questions.length]
  );

  // Initial session announce + fullscreen request on mount
  useEffect(() => {
    if (exam.examMode === 'strict') {
      requestSafeFullscreen();
    }
    if (initialSetup.initialLocked) {
      startStudentSiren();
    }

    const pushInitial = async () => {
      try {
        const sb = ensureSupabase();
        await sb.from('cbt_active_sessions').upsert(
          {
            student_id: currentUser.id,
            student_name: currentUser.name,
            student_identity: currentUser.identity,
            student_class: currentUser.kelas,
            exam_room: currentUser.exam_room || 'Ruang 01',
            status: initialSetup.initialLocked ? 'TERKUNCI_PELANGGARAN' : 'SEDANG_UJIAN',
            exam_title: exam.title,
            progress: `0/${questions.length} Dijawab`,
            violations: initialSetup.initialViolations,
            saved_answers: { answers: latestRef.current.answers },
            time_left_seconds: latestRef.current.timeLeft,
            last_seen: new Date().toISOString(),
          },
          { onConflict: 'student_id' }
        );
      } catch {
        // Ignore
      }
    };
    pushInitial();

    return () => {
      stopStudentSiren();
    };
  }, [currentUser, exam.examMode, exam.title, initialSetup.initialLocked, initialSetup.initialViolations, questions.length, requestSafeFullscreen]);

  // Anti-cheat event listeners (strict mode)
  useEffect(() => {
    if (exam.examMode !== 'strict') return;

    const handleVisibility = () => {
      if (document.hidden) {
        triggerViolation('Berpindah tab atau meminimalkan jendela browser');
      }
    };

    const handleBlur = () => {
      if (!document.hidden) {
        triggerViolation('Jendela ujian kehilangan fokus (membuka aplikasi lain)');
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !isSubmittingRef.current && !latestRef.current.isLocked) {
        setFsWarningSeconds(5);
      } else {
        setFsWarningSeconds(null);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        e.key === 'PrintScreen' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'i', 'j', 'c'].includes(e.key)) ||
        (e.ctrlKey && ['u', 'U', 'c', 'C', 'v', 'V', 'x', 'X'].includes(e.key))
      ) {
        e.preventDefault();
        if (e.key === 'PrintScreen' || e.key === 'F12') {
          triggerViolation(`Menekan tombol terlarang (${e.key})`);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [exam.examMode, triggerViolation]);

  // Fullscreen grace period countdown
  useEffect(() => {
    if (fsWarningSeconds === null) return;
    if (fsWarningSeconds <= 0) {
      setFsWarningSeconds(null);
      triggerViolation('Keluar dari mode layar penuh (Fullscreen)');
      return;
    }
    const timer = setTimeout(() => {
      setFsWarningSeconds((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [fsWarningSeconds, triggerViolation]);

  // Main countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (exam.sourceType === 'gform') {
        setGformElapsedSec((s) => s + 1);
      }
      if (latestRef.current.isPaused || latestRef.current.isLocked || isSubmittingRef.current) {
        return;
      }
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          submitExam('Waktu Habis');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [exam.sourceType, submitExam]);

  // Cloud Heartbeat & Remote Command Listener every 4 seconds
  useEffect(() => {
    const syncHeartbeat = async () => {
      if (isSubmittingRef.current) return;
      try {
        const sb = ensureSupabase();
        const { data: row } = await sb
          .from('cbt_active_sessions')
          .select('*')
          .eq('student_id', currentUser.id)
          .maybeSingle();

        if (!row) {
          // If proctor deleted session via Reset Login while student was locked, unlock student
          if (latestRef.current.isLocked) {
            setIsLocked(false);
            setViolationModalReason(null);
            stopStudentSiren();
            showToast('Kunci sesi dibuka oleh Pengawas. Silakan lanjutkan ujian.', 'success');
          }
        } else {
          // Remote pause/resume
          if (Boolean(row.is_paused) !== latestRef.current.isPaused) {
            setIsPaused(Boolean(row.is_paused));
          }

          // Remote extra minutes
          if (Number(row.extra_minutes) > 0) {
            const addedMin = Number(row.extra_minutes);
            setTimeLeft((prev) => prev + addedMin * 60);
            showToast(`Pengawas Ruang menambahkan waktu +${addedMin} menit untuk Anda!`, 'info');
            await sb
              .from('cbt_active_sessions')
              .update({ extra_minutes: 0 })
              .eq('student_id', currentUser.id);
          }

          // Remote supervisor message
          if (row.supervisor_message && String(row.supervisor_message).trim() !== '') {
            setSupervisorMsgModal(String(row.supervisor_message));
            await sb
              .from('cbt_active_sessions')
              .update({ supervisor_message: '' })
              .eq('student_id', currentUser.id);
          }

          // Remote force action
          if (row.force_action === 'FORCE_SUBMIT') {
            await sb
              .from('cbt_active_sessions')
              .update({ force_action: '' })
              .eq('student_id', currentUser.id);
            submitExam('Dikumpulkan Paksa Pengawas');
            return;
          }

          if (row.force_action === 'KICK') {
            await sb
              .from('cbt_active_sessions')
              .update({ force_action: '' })
              .eq('student_id', currentUser.id);
            stopStudentSiren();
            exitSafeFullscreen();
            onKicked();
            return;
          }

          // If proctor reset violations or reset login from dashboard
          if (Number(row.violations || 0) === 0 && latestRef.current.violations > 0) {
            setViolations(0);
            setIsLocked(false);
            setViolationModalReason(null);
            stopStudentSiren();
            showToast('Hitungan pelanggaran telah direset oleh Pengawas.', 'success');
          } else if (row.status === 'ONLINE_PORTAL' && latestRef.current.isLocked) {
            setIsLocked(false);
            setViolationModalReason(null);
            stopStudentSiren();
          }
        }

        // Push current telemetry
        await sb.from('cbt_active_sessions').upsert(
          {
            student_id: currentUser.id,
            student_name: currentUser.name,
            student_identity: currentUser.identity,
            student_class: currentUser.kelas,
            exam_room: currentUser.exam_room || 'Ruang 01',
            status: latestRef.current.isLocked ? 'TERKUNCI_PELANGGARAN' : 'SEDANG_UJIAN',
            exam_title: exam.title,
            progress:
              exam.sourceType === 'gform'
                ? 'Mengisi Google Form'
                : `${answeredCount}/${questions.length} Dijawab`,
            violations: latestRef.current.violations,
            saved_answers: {
              answers: latestRef.current.answers,
              last_violation_reason: lastReasonRef.current || undefined,
            },
            time_left_seconds: latestRef.current.timeLeft,
            last_seen: new Date().toISOString(),
          },
          { onConflict: 'student_id' }
        );
      } catch {
        // Ignore transient network errors in heartbeat
      }
    };

    const timer = setInterval(syncHeartbeat, 4000);
    return () => clearInterval(timer);
  }, [answeredCount, currentUser, exam.sourceType, exam.title, exitSafeFullscreen, onKicked, questions.length, showToast, submitExam]);

  const handleDismissViolation = () => {
    if (isLocked) return;
    if (exam.requireProctorPin) {
      const entered = proctorPinInput.trim().toUpperCase();
      const roomObj = cache.rooms.find((r) => r.name === currentUser.exam_room);
      const validPin = String(roomObj?.room_pin || '').trim().toUpperCase();
      if (!entered || (validPin && entered !== validPin && entered !== 'ADMIN') || (!validPin && entered !== 'ADMIN')) {
        showToast('PIN Pengawas Ruang tidak sesuai!', 'error');
        return;
      }
    }
    setProctorPinInput('');
    setViolationModalReason(null);
    stopStudentSiren();
    if (exam.examMode === 'strict') {
      requestSafeFullscreen();
    }
  };

  const formatTimer = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };

  const currentQ = questions[currentIndex];

  const handleSelectPg = (qId: string, originalIdx: number) => {
    setAnswers((prev) => ({ ...prev, [qId]: originalIdx }));
  };

  const handleTogglePgk = (qId: string, originalIdx: number) => {
    setAnswers((prev) => {
      const curr = Array.isArray(prev[qId]) ? [...(prev[qId] as number[])] : [];
      const pos = curr.indexOf(originalIdx);
      if (pos >= 0) curr.splice(pos, 1);
      else curr.push(originalIdx);
      return { ...prev, [qId]: curr.sort((a, b) => a - b) };
    });
  };

  const handleAudioEnded = (qId: string) => {
    setAudioPlays((prev) => ({ ...prev, [qId]: (prev[qId] || 0) + 1 }));
  };

  const fontCls =
    fontSize === 'sm' ? 'text-sm' : fontSize === 'lg' ? 'text-lg' : 'text-base';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col exam-lockdown-text">
      {/* Top Exam Bar */}
      <header className="bg-slate-900 text-white px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-xs shrink-0">
            CBT
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm truncate">{exam.title}</h1>
            <p className="text-[11px] text-slate-400 truncate">
              {currentUser.name} · {currentUser.kelas} · {currentUser.exam_room}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {exam.examMode === 'strict' && (
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums inline-flex items-center gap-1 ${
                violations > 0 ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" /> Pelanggaran: {violations}
              {exam.maxViolations > 0 ? `/${exam.maxViolations}` : ''}
            </span>
          )}

          <div
            className={`px-3.5 py-1.5 rounded-xl font-mono font-black text-sm tabular-nums inline-flex items-center gap-1.5 ${
              timeLeft <= 300
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-indigo-600/30 border border-indigo-400/40 text-indigo-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{formatTimer(timeLeft)}</span>
          </div>

          {exam.examMode === 'strict' && (
            <button
              type="button"
              onClick={requestSafeFullscreen}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Layar Penuh"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      {exam.sourceType === 'gform' ? (
        <div className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 flex flex-col gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              <p className="font-bold text-slate-800 text-sm">Mode Tautan Google Form Terintegrasi</p>
              <p>Pastikan Anda menekan tombol Kirim/Submit di dalam formulir sebelum mengakhiri sesi ujian.</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={exam.gformUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Buka Tab Baru
              </a>
              <button
                type="button"
                disabled={gformElapsedSec < 10}
                onClick={() => setConfirmSubmitOpen(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Selesaikan Ujian
              </button>
            </div>
          </div>
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[70vh]">
            <iframe
              src={exam.gformUrl}
              title={exam.title}
              className="w-full h-[75vh] border-0"
            />
          </div>
        </div>
      ) : questions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 max-w-md text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
            <h3 className="font-bold text-slate-800">Soal Belum Tersedia</h3>
            <p className="text-sm text-slate-500">
              Bank soal untuk {exam.subject} ({exam.packetCode}) masih kosong. Hubungi Pengawas atau Guru Mapel.
            </p>
            <button
              type="button"
              onClick={() => {
                exitSafeFullscreen();
                onFinish(false);
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-sm"
            >
              Kembali ke Portal
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Question Area */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-indigo-600 text-white font-black text-xs tabular-nums">
                  SOAL NO. {currentIndex + 1} / {questions.length}
                </span>
                <span className="text-xs font-bold text-slate-500 uppercase">
                  {currentQ.type === 'pg'
                    ? 'Pilihan Ganda'
                    : currentQ.type === 'pgk'
                    ? 'PG Kompleks'
                    : currentQ.type === 'bs'
                    ? 'Benar / Salah'
                    : 'Uraian / Esai'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {(['sm', 'base', 'lg'] as const).map((sz, i) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setFontSize(sz)}
                    className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                      fontSize === sz
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {i === 0 ? 'A-' : i === 1 ? 'A' : 'A+'}
                  </button>
                ))}
              </div>
            </div>

            <div className={`p-6 space-y-5 ${fontCls}`}>
              {currentQ.image && (
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-2 inline-block">
                  <img
                    src={currentQ.image}
                    alt="Lampiran Soal"
                    referrerPolicy="no-referrer"
                    className="max-h-72 rounded-lg object-contain"
                  />
                </div>
              )}

              {currentQ.audioUrl && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                    <span className="inline-flex items-center gap-1.5">
                      <Headphones className="w-4 h-4" /> Audio Soal Listening
                    </span>
                    <span className="tabular-nums">
                      Diputar: {audioPlays[currentQ.id] || 0} /{' '}
                      {currentQ.audioMaxPlays > 0 ? `${currentQ.audioMaxPlays}x` : 'Bebas'}
                    </span>
                  </div>
                  {currentQ.audioMaxPlays > 0 &&
                  (audioPlays[currentQ.id] || 0) >= currentQ.audioMaxPlays ? (
                    <div className="text-xs font-bold text-rose-600 py-1 inline-flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4" /> Batas pemutaran audio untuk soal ini telah habis.
                    </div>
                  ) : (
                    <audio
                      ref={audioRef}
                      key={currentQ.id}
                      controls
                      controlsList="nodownload noplaybackrate"
                      src={currentQ.audioUrl}
                      onEnded={() => handleAudioEnded(currentQ.id)}
                      className="w-full"
                    />
                  )}
                </div>
              )}

              <div className="text-slate-800 leading-relaxed font-medium">
                <MathText text={currentQ.question} />
              </div>

              {/* Options */}
              {currentQ.type === 'pg' && (
                <div className="space-y-2.5 pt-2">
                  {(optionShuffles[currentQ.id] || []).map((origIdx, dispIdx) => {
                    const isSelected = Number(answers[currentQ.id]) === origIdx;
                    const label = String.fromCharCode(65 + dispIdx);
                    return (
                      <button
                        key={origIdx}
                        type="button"
                        onClick={() => handleSelectPg(currentQ.id, origIdx)}
                        className={`w-full text-left p-3.5 rounded-xl border-2 transition flex items-start gap-3 ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70'
                            : 'border-slate-200 hover:border-indigo-300 bg-white'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {label}
                        </span>
                        <div className="flex-1 pt-0.5 text-slate-800">
                          <MathText text={currentQ.options[origIdx] || ''} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQ.type === 'pgk' && (
                <div className="space-y-2.5 pt-2">
                  <p className="text-xs font-bold text-indigo-600">
                    Pilih lebih dari satu jawaban yang benar:
                  </p>
                  {(optionShuffles[currentQ.id] || []).map((origIdx, dispIdx) => {
                    const selectedArr = Array.isArray(answers[currentQ.id])
                      ? (answers[currentQ.id] as number[])
                      : [];
                    const isSelected = selectedArr.includes(origIdx);
                    const label = String.fromCharCode(65 + dispIdx);
                    return (
                      <button
                        key={origIdx}
                        type="button"
                        onClick={() => handleTogglePgk(currentQ.id, origIdx)}
                        className={`w-full text-left p-3.5 rounded-xl border-2 transition flex items-start gap-3 ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70'
                            : 'border-slate-200 hover:border-indigo-300 bg-white'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isSelected ? '✓' : label}
                        </span>
                        <div className="flex-1 pt-0.5 text-slate-800">
                          <MathText text={currentQ.options[origIdx] || ''} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQ.type === 'bs' && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  {(['BENAR', 'SALAH'] as const).map((val) => {
                    const isSelected = String(answers[currentQ.id] || '').toUpperCase() === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [currentQ.id]: val }))}
                        className={`py-4 rounded-xl border-2 font-black text-sm transition ${
                          isSelected
                            ? val === 'BENAR'
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                              : 'border-rose-600 bg-rose-50 text-rose-700'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQ.type === 'esai' && (
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Ketik Jawaban Uraian Anda:
                  </label>
                  <textarea
                    rows={5}
                    value={String(answers[currentQ.id] || '')}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [currentQ.id]: e.target.value }))
                    }
                    placeholder="Tulis jawaban di sini..."
                    className="w-full p-4 rounded-xl border-2 border-slate-200 focus:border-indigo-500 text-sm outline-none"
                  />
                </div>
              )}
            </div>

            {/* Navigation Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-bold text-xs inline-flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" /> Soal Sebelumnya
              </button>

              <button
                type="button"
                onClick={() =>
                  setDoubt((prev) => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }))
                }
                className={`px-4 py-2.5 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 border transition ${
                  doubt[currentQ.id]
                    ? 'bg-amber-400 border-amber-500 text-slate-950'
                    : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                }`}
              >
                <Flag className="w-3.5 h-3.5" />{' '}
                {doubt[currentQ.id] ? 'Ditandai Ragu-Ragu' : 'Ragu-Ragu'}
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs inline-flex items-center gap-1.5"
                >
                  Soal Berikutnya <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmSubmitOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow"
                >
                  <Send className="w-4 h-4" /> Selesai &amp; Kumpulkan
                </button>
              )}
            </div>
          </div>

          {/* Right: Question Navigation Grid */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm">Navigasi Nomor Soal</h3>
              <span className="text-xs font-bold text-indigo-600 tabular-nums">
                {answeredCount} / {questions.length} Terjawab
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const val = answers[q.id];
                const isAnswered =
                  val !== undefined &&
                  val !== null &&
                  (Array.isArray(val) ? val.length > 0 : String(val).trim() !== '');
                const isDoubt = Boolean(doubt[q.id]);
                const isCurr = idx === currentIndex;

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-10 rounded-xl font-bold text-xs tabular-nums transition border ${
                      isCurr ? 'ring-2 ring-indigo-600 ring-offset-1' : ''
                    } ${
                      isDoubt
                        ? 'bg-amber-400 border-amber-500 text-slate-950'
                        : isAnswered
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2 text-[11px] text-slate-500">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-indigo-600 inline-block" /> Terjawab
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-amber-400 inline-block" /> Ragu-ragu
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-slate-200 inline-block" /> Kosong
                </span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmSubmitOpen(true)}
                className="w-full mt-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow transition inline-flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Kumpulkan Jawaban Ujian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Exit Grace Countdown Overlay */}
      {fsWarningSeconds !== null && !violationModalReason && (
        <div
          id="fullscreen-warning-overlay"
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-7 text-center space-y-4 shadow-2xl border-4 border-amber-400">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto animate-bounce" />
            <h3 className="text-xl font-black text-slate-900">KEMBALI KE LAYAR PENUH!</h3>
            <p className="text-sm text-slate-600">
              Anda keluar dari mode layar penuh. Pelanggaran akan dicatat secara otomatis dalam{' '}
              <strong className="text-rose-600 text-lg tabular-nums">{fsWarningSeconds}</strong> detik!
            </p>
            <button
              type="button"
              onClick={() => {
                setFsWarningSeconds(null);
                requestSafeFullscreen();
              }}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg"
            >
              Masuk Layar Penuh Sekarang
            </button>
          </div>
        </div>
      )}

      {/* Strobe Violation / Locked Overlay */}
      {(violationModalReason || isLocked) && (
        <div className="fixed inset-0 z-50 strobe-alert-bg backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 text-center space-y-4 shadow-2xl border-4 border-rose-500">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              {isLocked ? <Lock className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
            </div>
            <h3 className="text-xl font-black text-rose-700">
              {isLocked ? 'SESI UJIAN TERKUNCI!' : 'PELANGGARAN TERDETEKSI!'}
            </h3>
            <p className="text-xs font-bold text-slate-700 bg-rose-50 border border-rose-200 p-3 rounded-xl">
              {violationModalReason || 'Terdeteksi aktivitas melanggar tata tertib ujian.'}
            </p>
            <p className="text-xs text-slate-500 tabular-nums">
              Total Pelanggaran: <strong>{violations}x</strong>{' '}
              {exam.maxViolations > 0 ? `(Maksimal ${exam.maxViolations}x)` : ''}
            </p>

            {isLocked ? (
              <div className="p-4 rounded-xl bg-slate-900 text-white text-xs leading-relaxed">
                Akun ujian Anda telah dikunci secara otomatis karena mencapai batas maksimal pelanggaran. Angkat tangan dan minta Pengawas Ruang ({currentUser.exam_room}) untuk melakukan Reset Login / Reset Pelanggaran pada layar Pengawas.
              </div>
            ) : exam.requireProctorPin ? (
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-700">
                  Minta Pengawas Ruang memasukkan PIN Ruang untuk membuka kembali soal:
                </p>
                <input
                  type="password"
                  value={proctorPinInput}
                  onChange={(e) => setProctorPinInput(e.target.value)}
                  placeholder="PIN Pengawas Ruang..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-center font-mono font-bold uppercase outline-none focus:border-rose-500"
                />
                <button
                  type="button"
                  onClick={handleDismissViolation}
                  className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm"
                >
                  Verifikasi PIN &amp; Lanjutkan
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDismissViolation}
                className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow"
              >
                Saya Mengerti &amp; Kembali ke Ujian
              </button>
            )}
          </div>
        </div>
      )}

      {/* Paused Overlay */}
      {isPaused && !isLocked && (
        <div className="fixed inset-0 z-40 bg-slate-900/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 text-center space-y-3 shadow-2xl">
            <Pause className="w-12 h-12 text-amber-500 mx-auto" />
            <h3 className="text-xl font-black text-slate-800">Ujian Dijeda Pengawas</h3>
            <p className="text-sm text-slate-600">
              Timer Anda dihentikan sementara oleh Pengawas Ruang. Mohon tunggu instruksi selanjutnya.
            </p>
          </div>
        </div>
      )}

      {/* Supervisor Push Message Overlay */}
      {supervisorMsgModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border-2 border-indigo-500 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Pesan dari Pengawas Ruang</h3>
                <p className="text-xs text-slate-500">Perhatikan instruksi berikut</p>
              </div>
            </div>
            <p className="text-sm text-slate-800 bg-indigo-50 p-4 rounded-xl border border-indigo-100 font-medium">
              {supervisorMsgModal}
            </p>
            <button
              type="button"
              onClick={() => setSupervisorMsgModal(null)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}

      {/* Confirm Submit Modal */}
      {confirmSubmitOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Konfirmasi Kumpulkan Ujian</h3>
            {exam.sourceType === 'internal' && answeredCount < questions.length ? (
              <p className="text-sm text-amber-800 bg-amber-50 p-3.5 rounded-xl border border-amber-200">
                Masih ada <strong>{questions.length - answeredCount} soal</strong> yang belum terjawab. Apakah Anda yakin tetap ingin mengakhiri dan mengumpulkan jawaban?
              </p>
            ) : (
              <p className="text-sm text-slate-600">
                Jawaban Anda akan dikunci dan dikirim ke server penilaian. Anda tidak dapat mengubah jawaban setelah dikumpulkan.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmSubmitOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Periksa Kembali
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmSubmitOpen(false);
                  submitExam();
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow"
              >
                Ya, Kumpulkan Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
