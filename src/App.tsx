import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Database,
  DoorOpen,
  FileText,
  GraduationCap,
  Grid,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Monitor,
  Pause,
  Play,
  RefreshCw,
  School,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
  Volume2,
  VolumeX,
  Wrench,
  X,
} from 'lucide-react';
import {
  BackupMigrationView,
  MasterDataView,
  SchoolSettingsView,
} from './components/AdminSchoolAndMaster';
import {
  StaffManagerView,
  StudentsManagerView,
  TeachersManagerView,
} from './components/AdminUsersManager';
import { ExamRoomView } from './components/ExamRoomView';
import { ExamScheduleManager } from './components/ExamScheduleManager';
import { LiveMonitorTable } from './components/LiveMonitorTable';
import { LoginView } from './components/LoginView';
import { QuestionBankView } from './components/QuestionBankView';
import {
  AnnouncementsView,
  EssayGradingView,
  KktpAnalysisView,
  ParticipantCardsView,
  ResultsAndBeritaAcaraView,
  SeatingPlanView,
  ViolationsLogView,
} from './components/ReportsAndPrintViews';
import { ResetCenterView } from './components/ResetCenterView';
import { StudentHistoryView, StudentPortalView } from './components/StudentPortalView';
import { SupervisorAlertBanner } from './components/SupervisorAlertBanner';
import {
  ChangePasswordModal,
  ConfirmModal,
  GlobalLoader,
  SqlSchemaModal,
  ToastContainer,
} from './components/ToastAndModals';
import {
  DEFAULT_CLASSES,
  DEFAULT_ROOMS,
  DEFAULT_SCHOOL_SETTINGS,
  DEFAULT_SESSIONS,
  DEFAULT_SUBJECTS,
  ensureSupabase,
  normalizeExamFromRow,
  normalizeQuestionFromRow,
  normalizeResultFromRow,
  supabaseClient,
} from './lib/supabase';
import {
  doesSessionMatchRoom,
  getSavedSession,
  getUnifiedViolationRecords,
  persistSession,
  resolveViolationReason,
  startSupervisorSiren,
  stopStudentSiren,
  stopSupervisorSiren,
  unlockSupervisorAudioContext,
} from './lib/utils';
import type {
  ActiveSession,
  AppCache,
  ExamSchedule,
  SupervisorAlertItem,
  ToastItem,
  UserSession,
} from './types/cbt';

const INITIAL_CACHE: AppCache = {
  schoolSettings: DEFAULT_SCHOOL_SETTINGS,
  subjects: DEFAULT_SUBJECTS,
  classes: DEFAULT_CLASSES,
  rooms: DEFAULT_ROOMS,
  sessions: DEFAULT_SESSIONS,
  questionPackets: [],
  students: [],
  teachers: [],
  staff: [],
  questions: [],
  exams: [],
  results: [],
  activeSessions: [],
  announcements: [],
  violationLogs: [],
};

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => getSavedSession());
  const [cache, setCache] = useState<AppCache>(INITIAL_CACHE);
  const [currentTab, setCurrentTab] = useState<string>('admin_overview');
  const [activeProctorRoom, setActiveProctorRoom] = useState<string>('');
  const [activeExam, setActiveExam] = useState<ExamSchedule | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [loadingState, setLoadingState] = useState<{ visible: boolean; text: string }>({
    visible: false,
    text: '',
  });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [sqlModalOpen, setSqlModalOpen] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: React.ReactNode;
    confirmText?: string;
    confirmTone?: 'indigo' | 'rose' | 'emerald' | 'amber';
    onConfirm: () => void | Promise<void>;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Supervisor Push Message Modal
  const [pushMsgTarget, setPushMsgTarget] = useState<{ id: string; name: string } | null>(null);
  const [pushMsgText, setPushMsgText] = useState('');

  // Supervisor Siren & Violation Queue
  const [isSirenMuted, setIsSirenMuted] = useState(false);
  const [supervisorQueue, setSupervisorQueue] = useState<SupervisorAlertItem[]>([]);
  const [supervisorQueueIndex, setSupervisorQueueIndex] = useState(0);
  const acknowledgedAlertsRef = useRef<Set<string>>(new Set());

  // Dedicated Print Wrapper for Berita Acara
  const [dedicatedPrintNode, setDedicatedPrintNode] = useState<React.ReactNode | null>(null);

  const setLoading = useCallback((visible: boolean, text = '') => {
    setLoadingState({ visible, text });
  }, []);

  const showToast = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Determine default tab and active proctor room whenever user logs in
  const initUserEnvironment = useCallback((user: UserSession) => {
    if (user.role === 'admin') {
      setCurrentTab('admin_overview');
      setActiveProctorRoom('ALL');
    } else if (user.role === 'kepsek') {
      setCurrentTab('kepsek_overview');
      setActiveProctorRoom('ALL');
    } else if (user.role === 'guru') {
      setCurrentTab('guru_overview');
      setActiveProctorRoom(user.proctor_room || 'Ruang 01');
    } else {
      setCurrentTab('student_portal');
      setActiveProctorRoom('');
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      initUserEnvironment(currentUser);
    }
  }, []); // only on initial restore

  // Evaluate Supervisor Violation Queue when activeSessions change
  const evaluateSupervisorAlerts = useCallback(
    (sessions: ActiveSession[], logs: AppCache['violationLogs'], user: UserSession | null, roomFilter: string, muted: boolean) => {
      if (!user || user.role === 'siswa') {
        setSupervisorQueue([]);
        stopSupervisorSiren();
        return;
      }

      const roomScope = user.role === 'guru' ? roomFilter || user.proctor_room || 'Ruang 01' : 'ALL';
      const activeAlerts: SupervisorAlertItem[] = [];

      sessions.forEach((s) => {
        const isViol = Number(s.violations || 0) > 0 || s.status === 'TERKUNCI_PELANGGARAN';
        if (!isViol) return;
        if (!doesSessionMatchRoom(s, roomScope)) return;
        const ackKey = `${s.student_id}_v${s.violations}_s${s.status}`;
        if (acknowledgedAlertsRef.current.has(ackKey)) return;

        activeAlerts.push({
          ackKey,
          student_id: s.student_id,
          student_name: s.student_name,
          student_class: s.student_class,
          exam_room: s.exam_room || 'Ruang 01',
          exam_title: s.exam_title || '-',
          violations: Number(s.violations || 0),
          status: s.status,
          reason: resolveViolationReason(s, logs),
        });
      });

      setSupervisorQueue(activeAlerts);
      if (activeAlerts.length > 0 && !muted) {
        startSupervisorSiren(muted);
      } else {
        stopSupervisorSiren();
      }
    },
    []
  );

  // Sync data from Supabase v5.0 15 tables
  const syncFromSupabase = useCallback(
    async (userOverride?: UserSession | null, silent = false) => {
      const targetUser = userOverride !== undefined ? userOverride : currentUser;
      if (!supabaseClient) {
        setDbConnected(false);
        return;
      }
      if (!silent) {
        setLoading(true, 'Menyinkronkan data dari Cloud...');
      }

      try {
        const sb = ensureSupabase();

        // Public / shared tables needed even on login view
        const [schoolRes, subRes, clsRes, rmRes, sesRes, annRes, exRes] = await Promise.all([
          sb.from('cbt_school_settings').select('*').eq('id', 'main').maybeSingle(),
          sb.from('cbt_subjects').select('*').order('name'),
          sb.from('cbt_classes').select('*').order('name'),
          sb.from('cbt_rooms').select('*').order('name'),
          sb.from('cbt_sessions').select('*').order('name'),
          sb.from('cbt_announcements').select('*').order('created_at', { ascending: false }),
          sb.from('cbt_exams').select('*').order('created_at', { ascending: false }),
        ]);

        if (schoolRes.error && schoolRes.error.code === '42P01') {
          setDbConnected(false);
          if (!silent) setLoading(false);
          return;
        }

        setDbConnected(true);

        const nextCache: AppCache = {
          schoolSettings: schoolRes.data ? { ...DEFAULT_SCHOOL_SETTINGS, ...schoolRes.data } : DEFAULT_SCHOOL_SETTINGS,
          subjects: subRes.data && subRes.data.length > 0 ? subRes.data : DEFAULT_SUBJECTS,
          classes: clsRes.data && clsRes.data.length > 0 ? clsRes.data : DEFAULT_CLASSES,
          rooms: rmRes.data && rmRes.data.length > 0 ? rmRes.data : DEFAULT_ROOMS,
          sessions: sesRes.data && sesRes.data.length > 0 ? sesRes.data : DEFAULT_SESSIONS,
          announcements: annRes.data || [],
          exams: (exRes.data || []).map((r) => normalizeExamFromRow(r as Record<string, unknown>)),
          questionPackets: [],
          students: [],
          teachers: [],
          staff: [],
          questions: [],
          results: [],
          activeSessions: [],
          violationLogs: [],
        };

        if (targetUser) {
          if (targetUser.role === 'siswa') {
            // Safe student query using student view first
            const viewQRes = await sb.from('cbt_questions_student_view').select('*');
            let qRows = viewQRes.data;
            if (viewQRes.error) {
              const fallbackQ = await sb
                .from('cbt_questions')
                .select('id, subject, packet_code, question_type, question, image, audio_url, audio_max_plays, options, question_weight');
              qRows = fallbackQ.data;
            }
            const [resRes, actRes] = await Promise.all([
              sb.from('cbt_results').select('*').eq('student_id', targetUser.id),
              sb.from('cbt_active_sessions').select('*').eq('student_id', targetUser.id),
            ]);
            nextCache.questions = (qRows || []).map((r) =>
              normalizeQuestionFromRow(r as Record<string, unknown>)
            );
            nextCache.results = (resRes.data || []).map((r) =>
              normalizeResultFromRow(r as Record<string, unknown>)
            );
            nextCache.activeSessions = (actRes.data || []) as ActiveSession[];
          } else {
            // Admin / Kepsek / Guru load full operational tables
            const [stuRes, tchRes, stfRes, pktRes, qRes, resRes, actRes, violRes] =
              await Promise.all([
                sb.from('cbt_students').select('*').order('name'),
                sb.from('cbt_teachers').select('*').order('name'),
                sb.from('cbt_staff').select('*').order('name'),
                sb.from('cbt_question_packets').select('*'),
                sb.from('cbt_questions').select('*').order('created_at', { ascending: false }),
                sb.from('cbt_results').select('*').order('submitted_at', { ascending: false }),
                sb.from('cbt_active_sessions').select('*').order('last_seen', { ascending: false }),
                sb.from('cbt_violation_logs').select('*').order('created_at', { ascending: false }).limit(250),
              ]);

            nextCache.students = stuRes.data || [];
            nextCache.teachers = tchRes.data || [];
            nextCache.staff = stfRes.data || [];
            nextCache.questionPackets = pktRes.data || [];
            nextCache.questions = (qRes.data || []).map((r) =>
              normalizeQuestionFromRow(r as Record<string, unknown>)
            );
            nextCache.results = (resRes.data || []).map((r) =>
              normalizeResultFromRow(r as Record<string, unknown>)
            );
            nextCache.activeSessions = (actRes.data || []) as ActiveSession[];
            nextCache.violationLogs = violRes.data || [];

            evaluateSupervisorAlerts(
              nextCache.activeSessions,
              nextCache.violationLogs,
              targetUser,
              activeProctorRoom,
              isSirenMuted
            );
          }
        }

        setCache(nextCache);
      } catch (err) {
        setDbConnected(false);
        if (!silent) {
          showToast('Koneksi cloud bermasalah: ' + (err as Error).message, 'warning');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [activeProctorRoom, currentUser, evaluateSupervisorAlerts, isSirenMuted, setLoading, showToast]
  );

  // Initial load on mount
  useEffect(() => {
    syncFromSupabase(currentUser, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime subscription + background polling for supervisors or student portal
  useEffect(() => {
    if (!currentUser || !supabaseClient) return;

    if (currentUser.role === 'siswa') {
      if (activeExam) return; // ExamRoomView handles its own heartbeat
      const pushPortalPresence = async () => {
        try {
          const sb = ensureSupabase();
          const { data: existing } = await sb
            .from('cbt_active_sessions')
            .select('status, force_action')
            .eq('student_id', currentUser.id)
            .maybeSingle();

          if (existing?.force_action === 'KICK') {
            await sb.from('cbt_active_sessions').update({ force_action: '' }).eq('student_id', currentUser.id);
            handleLogout(true);
            return;
          }
          if (existing?.status === 'TERKUNCI_PELANGGARAN') {
            return;
          }

          await sb.from('cbt_active_sessions').upsert(
            {
              student_id: currentUser.id,
              student_name: currentUser.name,
              student_identity: currentUser.identity,
              student_class: currentUser.kelas,
              exam_room: currentUser.exam_room || 'Ruang 01',
              status: 'ONLINE_PORTAL',
              exam_title: '-',
              progress: 'Di Halaman Portal',
              last_seen: new Date().toISOString(),
            },
            { onConflict: 'student_id' }
          );
        } catch {
          // Ignore
        }
      };

      pushPortalPresence();
      const iv = setInterval(() => {
        pushPortalPresence();
        syncFromSupabase(currentUser, true);
      }, 10000);
      return () => clearInterval(iv);
    }

    // Supervisor Realtime + Polling
    const client = supabaseClient;
    const channel = client
      .channel('cbt_live_proctor')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cbt_active_sessions' },
        () => {
          syncFromSupabase(currentUser, true);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cbt_violation_logs' },
        () => {
          syncFromSupabase(currentUser, true);
        }
      )
      .subscribe();

    const pollIv = setInterval(() => {
      syncFromSupabase(currentUser, true);
    }, 8000);

    return () => {
      client.removeChannel(channel);
      clearInterval(pollIv);
    };
  }, [activeExam, currentUser, syncFromSupabase]);

  const handleLoginSuccess = async (user: UserSession) => {
    persistSession(user);
    setCurrentUser(user);
    initUserEnvironment(user);
    if (user.role !== 'siswa') {
      unlockSupervisorAudioContext();
    }
    await syncFromSupabase(user, false);
    showToast(`Selamat datang, ${user.name}!`, 'success');
  };

  const handleLogout = async (wasKicked = false) => {
    stopSupervisorSiren();
    stopStudentSiren();
    if (currentUser && currentUser.role === 'siswa' && supabaseClient) {
      try {
        await supabaseClient
          .from('cbt_active_sessions')
          .delete()
          .eq('student_id', currentUser.id)
          .neq('status', 'TERKUNCI_PELANGGARAN');
      } catch {
        // Ignore
      }
    }
    persistSession(null);
    setActiveExam(null);
    setCurrentUser(null);
    setSupervisorQueue([]);
    if (wasKicked) {
      showToast('Anda telah dikeluarkan dari sesi oleh Pengawas Ruang.', 'warning');
    } else {
      showToast('Anda telah keluar dari sistem.', 'info');
    }
  };

  // Generic delete confirmation helper
  const handleDeleteRecord = (table: string, id: string) => {
    setConfirmState({
      open: true,
      title: 'Konfirmasi Hapus Data',
      message: 'Data yang dihapus akan hilang secara permanen dari server database. Lanjutkan?',
      confirmText: 'Ya, Hapus Permanen',
      confirmTone: 'rose',
      onConfirm: async () => {
        setLoading(true, 'Menghapus data...');
        try {
          const sb = ensureSupabase();
          const { error } = await sb.from(table).delete().eq('id', id);
          if (error) throw error;
          showToast('Data berhasil dihapus.', 'success');
          await syncFromSupabase(currentUser, true);
        } catch (err) {
          showToast('Gagal menghapus data: ' + (err as Error).message, 'error');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // Supervisor Remote Actions
  const handleResetLogin = async (studentId: string, studentName: string) => {
    setLoading(true, `Membuka kunci login ${studentName}...`);
    try {
      const sb = ensureSupabase();
      await sb.from('cbt_active_sessions').delete().eq('student_id', studentId);
      setSupervisorQueue((prev) => prev.filter((item) => item.student_id !== studentId));
      showToast(`Sesi login ${studentName} berhasil direset! Siswa dapat masuk kembali.`, 'success');
      await syncFromSupabase(currentUser, true);
    } catch (err) {
      showToast('Gagal Reset Login: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSupervisorAction = async (
    studentId: string,
    studentName: string,
    actionCode: string
  ) => {
    setLoading(true, `Menjalankan aksi untuk ${studentName}...`);
    try {
      const sb = ensureSupabase();
      if (actionCode === 'RESET_VIOLATIONS') {
        await sb
          .from('cbt_active_sessions')
          .update({ violations: 0, status: 'SEDANG_UJIAN' })
          .eq('student_id', studentId);
        setSupervisorQueue((prev) => prev.filter((item) => item.student_id !== studentId));
        showToast(`Pelanggaran ${studentName} berhasil dinolkan.`, 'success');
      } else if (actionCode === 'FORCE_SUBMIT' || actionCode === 'KICK') {
        await sb
          .from('cbt_active_sessions')
          .update({ force_action: actionCode })
          .eq('student_id', studentId);
        showToast(
          actionCode === 'FORCE_SUBMIT'
            ? `Perintah Kumpulkan Paksa dikirim ke ${studentName}.`
            : `Perintah Kick dikirim ke ${studentName}.`,
          'warning'
        );
      }
      await syncFromSupabase(currentUser, true);
    } catch (err) {
      showToast('Gagal mengirim aksi: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGrantExtraTime = async (
    studentId: string,
    studentName: string,
    minutes = 5
  ) => {
    setLoading(true, `Menambah waktu +${minutes} menit...`);
    try {
      const sb = ensureSupabase();
      await sb
        .from('cbt_active_sessions')
        .update({ extra_minutes: minutes })
        .eq('student_id', studentId);
      showToast(`Tambahan waktu +${minutes} menit dikirim ke ${studentName}.`, 'success');
      await syncFromSupabase(currentUser, true);
    } catch (err) {
      showToast('Gagal menambah waktu: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetExamFromLive = (
    studentId: string,
    studentName: string,
    examTitle: string
  ) => {
    setConfirmState({
      open: true,
      title: `Reset Ujian: ${studentName}`,
      message: (
        <span>
          Hapus hasil nilai ujian <strong>{examTitle || 'terakhir'}</strong> serta reset sesi aktif untuk{' '}
          <strong>{studentName}</strong> agar dapat mengulang ujian dari awal?
        </span>
      ),
      confirmText: 'Ya, Reset Ujian',
      confirmTone: 'rose',
      onConfirm: async () => {
        setLoading(true, `Mereset ujian ${studentName}...`);
        try {
          const sb = ensureSupabase();
          if (examTitle) {
            await sb
              .from('cbt_results')
              .delete()
              .eq('student_id', studentId)
              .eq('exam_title', examTitle);
          } else {
            await sb.from('cbt_results').delete().eq('student_id', studentId);
          }
          await sb.from('cbt_active_sessions').delete().eq('student_id', studentId);
          showToast(`Ujian ${studentName} berhasil direset.`, 'success');
          await syncFromSupabase(currentUser, true);
        } catch (err) {
          showToast('Gagal reset ujian: ' + (err as Error).message, 'error');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleSendPushMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushMsgTarget || !pushMsgText.trim()) return;
    setLoading(true, `Mengirim pesan ke ${pushMsgTarget.name}...`);
    try {
      const sb = ensureSupabase();
      await sb
        .from('cbt_active_sessions')
        .update({ supervisor_message: pushMsgText.trim() })
        .eq('student_id', pushMsgTarget.id);
      showToast(`Pesan terkirim ke layar ${pushMsgTarget.name}!`, 'success');
      setPushMsgTarget(null);
      setPushMsgText('');
    } catch (err) {
      showToast('Gagal mengirim pesan: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRoomPause = async (roomName: string, pause: boolean) => {
    setLoading(true, pause ? `Menjeda ruang ${roomName}...` : `Melanjutkan ruang ${roomName}...`);
    try {
      const sb = ensureSupabase();
      const { error } = await sb
        .from('cbt_active_sessions')
        .update({ is_paused: pause })
        .eq('exam_room', roomName)
        .eq('status', 'SEDANG_UJIAN');
      if (error) throw error;
      showToast(
        pause
          ? `Seluruh peserta di ${roomName} berhasil dijeda.`
          : `Seluruh peserta di ${roomName} dilanjutkan kembali.`,
        'success'
      );
      await syncFromSupabase(currentUser, true);
    } catch (err) {
      showToast('Gagal memproses jeda ruang: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Alert Banner handlers
  const handleDismissCurrentAlert = () => {
    const item = supervisorQueue[supervisorQueueIndex] || supervisorQueue[0];
    if (item) {
      acknowledgedAlertsRef.current.add(item.ackKey);
    }
    const nextQ = supervisorQueue.filter((_, i) => i !== supervisorQueueIndex);
    setSupervisorQueue(nextQ);
    setSupervisorQueueIndex(0);
    if (nextQ.length === 0) stopSupervisorSiren();
  };

  const handleDismissAllAlerts = () => {
    supervisorQueue.forEach((item) => acknowledgedAlertsRef.current.add(item.ackKey));
    setSupervisorQueue([]);
    setSupervisorQueueIndex(0);
    stopSupervisorSiren();
  };

  const handleVerifyRoomCodeAlert = async (
    _code: string,
    targetRoom: string,
    item: SupervisorAlertItem
  ) => {
    acknowledgedAlertsRef.current.add(item.ackKey);
    await handleResetViolationsAndUnlock(item.student_id, item.student_name, targetRoom);
  };

  const handleResetViolationsAndUnlock = async (
    studentId: string,
    studentName: string,
    targetRoom?: string
  ) => {
    await handleSupervisorAction(studentId, studentName, 'RESET_VIOLATIONS');
    if (targetRoom) {
      showToast(`Kode Ruang ${targetRoom} terverifikasi. Sesi ${studentName} dibuka!`, 'success');
    }
  };

  // Dedicated Print Helper (Berita Acara)
  const handlePrintDedicated = (node: React.ReactNode) => {
    setDedicatedPrintNode(node);
    document.body.classList.add('printing-dedicated');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('printing-dedicated');
        setDedicatedPrintNode(null);
      }, 300);
    }, 200);
  };

  // Render active exam fullscreen runner if student is taking an exam
  if (currentUser?.role === 'siswa' && activeExam) {
    return (
      <>
        <GlobalLoader visible={loadingState.visible} text={loadingState.text} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <ExamRoomView
          cache={cache}
          currentUser={currentUser}
          exam={activeExam}
          onFinish={async (submitted) => {
            setActiveExam(null);
            await syncFromSupabase(currentUser, true);
            setCurrentTab(submitted ? 'student_history' : 'student_portal');
          }}
          onKicked={() => handleLogout(true)}
          setLoading={setLoading}
          showToast={showToast}
        />
      </>
    );
  }

  // Render Login screen if unauthenticated
  if (!currentUser) {
    return (
      <>
        <GlobalLoader visible={loadingState.visible} text={loadingState.text} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <SqlSchemaModal
          open={sqlModalOpen}
          onClose={() => setSqlModalOpen(false)}
          showToast={showToast}
        />
        <LoginView
          school={cache.schoolSettings}
          announcements={cache.announcements}
          dbConnected={dbConnected}
          onLoginSuccess={handleLoginSuccess}
          onOpenSqlModal={() => setSqlModalOpen(true)}
          setLoading={setLoading}
          showToast={showToast}
        />
      </>
    );
  }

  // Build role-based navigation items
  const pendingEssayCount = cache.results.filter((r) => r.gradingStatus === 'pending_essay').length;
  const lockedCount = cache.activeSessions.filter((s) => s.status === 'TERKUNCI_PELANGGARAN').length;
  const unifiedViolCount = getUnifiedViolationRecords(cache).length;

  const navItems: NavItem[] =
    currentUser.role === 'admin'
      ? [
          { id: 'admin_overview', label: 'Dasbor Utama', icon: <LayoutDashboard className="w-4 h-4" /> },
          { id: 'admin_school', label: 'Identitas Sekolah', icon: <School className="w-4 h-4" /> },
          { id: 'admin_master', label: 'Data Master & Plotting', icon: <Grid className="w-4 h-4" /> },
          { id: 'admin_students', label: 'Peserta / Siswa', icon: <GraduationCap className="w-4 h-4" /> },
          { id: 'admin_teachers', label: 'Guru & Pengawas', icon: <Users className="w-4 h-4" /> },
          { id: 'admin_staff', label: 'Admin & Kepsek', icon: <ShieldCheck className="w-4 h-4" /> },
          { id: 'bank_soal', label: 'Bank Soal CBT', icon: <BookOpen className="w-4 h-4" /> },
          { id: 'jadwal_ujian', label: 'Jadwal & Token Ujian', icon: <CalendarDays className="w-4 h-4" /> },
          { id: 'reset_center', label: 'Pusat Reset Ujian', icon: <Wrench className="w-4 h-4" />, badge: lockedCount || undefined },
          { id: 'cards', label: 'Cetak Kartu Peserta', icon: <CreditCard className="w-4 h-4" /> },
          { id: 'seating', label: 'Denah Duduk Ruang', icon: <DoorOpen className="w-4 h-4" /> },
          { id: 'results', label: 'Nilai & Berita Acara', icon: <Award className="w-4 h-4" /> },
          { id: 'essay_grading', label: 'Koreksi Esai', icon: <ClipboardCheck className="w-4 h-4" />, badge: pendingEssayCount || undefined },
          { id: 'kktp', label: 'Analisis KKTP', icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'violations', label: 'Log Pelanggaran', icon: <AlertTriangle className="w-4 h-4" />, badge: unifiedViolCount || undefined },
          { id: 'announcements', label: 'Pengumuman', icon: <Megaphone className="w-4 h-4" /> },
          { id: 'backup', label: 'Backup & Skema SQL', icon: <Database className="w-4 h-4" /> },
        ]
      : currentUser.role === 'kepsek'
      ? [
          { id: 'kepsek_overview', label: 'Dasbor Eksekutif', icon: <LayoutDashboard className="w-4 h-4" /> },
          { id: 'kepsek_live_rooms', label: 'Pantau Ruang Live', icon: <Monitor className="w-4 h-4" /> },
          { id: 'results', label: 'Rekap Nilai & BA', icon: <Award className="w-4 h-4" /> },
          { id: 'kktp', label: 'Analisis KKTP', icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'violations', label: 'Log Pelanggaran', icon: <AlertTriangle className="w-4 h-4" />, badge: unifiedViolCount || undefined },
        ]
      : currentUser.role === 'guru'
      ? [
          { id: 'guru_overview', label: 'Ringkasan Guru', icon: <LayoutDashboard className="w-4 h-4" /> },
          { id: 'guru_proctor_room', label: 'Ruang Pengawas Live', icon: <Monitor className="w-4 h-4" />, badge: lockedCount || undefined },
          { id: 'reset_center', label: 'Pusat Reset Ruang', icon: <Wrench className="w-4 h-4" /> },
          { id: 'bank_soal', label: 'Bank Soal Mapel', icon: <BookOpen className="w-4 h-4" /> },
          { id: 'jadwal_ujian', label: 'Jadwal Ujian', icon: <CalendarDays className="w-4 h-4" /> },
          { id: 'essay_grading', label: 'Koreksi Esai', icon: <ClipboardCheck className="w-4 h-4" />, badge: pendingEssayCount || undefined },
          { id: 'results', label: 'Hasil Nilai & BA', icon: <Award className="w-4 h-4" /> },
          { id: 'kktp', label: 'Analisis KKTP', icon: <BarChart3 className="w-4 h-4" /> },
        ]
      : [
          { id: 'student_portal', label: 'Portal Ujian Aktif', icon: <FileText className="w-4 h-4" /> },
          { id: 'student_history', label: 'Riwayat & Nilai', icon: <Award className="w-4 h-4" /> },
        ];

  const onlineNowCount = cache.activeSessions.filter(
    (s) => s.status === 'TERKUNCI_PELANGGARAN' || Date.now() - new Date(s.last_seen).getTime() <= 45000
  ).length;

  const avgAllScores =
    cache.results.length > 0
      ? (
          cache.results.reduce((sum, r) => sum + Number(r.score || 0), 0) /
          cache.results.length
        ).toFixed(1)
      : '0.0';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row">
      <GlobalLoader visible={loadingState.visible} text={loadingState.text} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <SqlSchemaModal
        open={sqlModalOpen}
        onClose={() => setSqlModalOpen(false)}
        showToast={showToast}
      />
      <ChangePasswordModal
        open={pwdModalOpen}
        user={currentUser}
        onClose={() => setPwdModalOpen(false)}
        setLoading={setLoading}
        showToast={showToast}
      />
      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        confirmTone={confirmState.confirmTone}
        onConfirm={confirmState.onConfirm}
        onClose={() => setConfirmState((prev) => ({ ...prev, open: false }))}
      />

      {/* Push Message Modal */}
      {pushMsgTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <form
            onSubmit={handleSendPushMessage}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 fade-in"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" /> Kirim Pesan ke {pushMsgTarget.name}
              </h3>
              <button
                type="button"
                onClick={() => setPushMsgTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              rows={3}
              required
              autoFocus
              value={pushMsgText}
              onChange={(e) => setPushMsgText(e.target.value)}
              placeholder="Contoh: Harap tetap fokus pada layar ujian dan jangan berpindah tab."
              className="w-full p-3.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPushMsgTarget(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold inline-flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Kirim Instan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Supervisor Floating Alert Banner */}
      {currentUser.role !== 'siswa' && (
        <SupervisorAlertBanner
          queue={supervisorQueue}
          queueIndex={supervisorQueueIndex}
          rooms={cache.rooms}
          activeProctorRoom={activeProctorRoom}
          onNavigateQueue={(delta) =>
            setSupervisorQueueIndex((prev) =>
              supervisorQueue.length === 0
                ? 0
                : (prev + delta + supervisorQueue.length) % supervisorQueue.length
            )
          }
          onDismissCurrent={handleDismissCurrentAlert}
          onDismissAll={handleDismissAllAlerts}
          onVerifyRoomCode={handleVerifyRoomCodeAlert}
          onResetLogin={handleResetLogin}
          onResetViolations={(id, name) => handleSupervisorAction(id, name, 'RESET_VIOLATIONS')}
          onOpenPushMessage={(id, name) => setPushMsgTarget({ id, name })}
          showToast={showToast}
        />
      )}

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden no-print"
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside
        className={`no-print fixed lg:sticky top-0 left-0 z-40 h-screen w-68 bg-slate-900 text-white flex flex-col shrink-0 transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-sm shrink-0 shadow">
              CBT
            </div>
            <div className="min-w-0">
              <p className="font-black text-sm tracking-tight truncate">EDU-CBT PRO v5.0</p>
              <p className="text-[11px] text-indigo-300 font-semibold truncate">
                {cache.schoolSettings.school_name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-800 bg-slate-800/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {currentUser.role === 'admin'
              ? 'Administrator Sistem'
              : currentUser.role === 'kepsek'
              ? 'Kepala Sekolah'
              : currentUser.role === 'guru'
              ? 'Guru & Pengawas Ruang'
              : 'Peserta Ujian'}
          </p>
          <p className="font-bold text-sm text-white truncate mt-0.5">{currentUser.name}</p>
          <p className="text-[11px] text-slate-400 font-mono truncate">
            {currentUser.role === 'siswa'
              ? `${currentUser.kelas} · ${currentUser.exam_room}`
              : currentUser.role === 'guru'
              ? `${currentUser.subject || '-'} · ${activeProctorRoom || 'Pilih Ruang'}`
              : currentUser.identity}
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setCurrentTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge ? (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black tabular-nums">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-1.5">
          <button
            type="button"
            onClick={() => setPwdModalOpen(true)}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            <KeyRound className="w-4 h-4" /> Ubah Kata Sandi
          </button>
          <button
            type="button"
            onClick={() => handleLogout(false)}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-300 hover:bg-rose-950/60"
          >
            <LogOut className="w-4 h-4" /> Keluar Sesi
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="no-print bg-white border-b border-slate-200 px-4 md:px-7 py-3.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-black text-slate-800 text-base md:text-lg leading-tight">
                {navItems.find((i) => i.id === currentTab)?.label || 'Dashboard CBT'}
              </h2>
              <p className="text-[11px] text-slate-500">
                TA {cache.schoolSettings.academic_year} · Semester {cache.schoolSettings.semester}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUser.role !== 'siswa' && (
              <button
                type="button"
                onClick={() => {
                  const next = !isSirenMuted;
                  setIsSirenMuted(next);
                  if (next) stopSupervisorSiren();
                  else if (supervisorQueue.length > 0) startSupervisorSiren(false);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border transition ${
                  isSirenMuted
                    ? 'bg-slate-100 border-slate-200 text-slate-600'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
                title="Toggle Suara Sirine Pengawas"
              >
                {isSirenMuted ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5" /> Sirine Bisukan
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5" /> Sirine Aktif
                  </>
                )}
              </button>
            )}

            {currentUser.role === 'admin' && (
              <button
                type="button"
                onClick={() => setSqlModalOpen(true)}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Database className="w-3.5 h-3.5" /> Skema SQL
              </button>
            )}

            <button
              type="button"
              onClick={() => syncFromSupabase(currentUser, false)}
              className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Sinkronkan
            </button>
          </div>
        </header>

        {/* View Content */}
        <main className="flex-1 p-4 md:p-7 max-w-7xl w-full mx-auto">
          {/* ADMIN OVERVIEW */}
          {currentTab === 'admin_overview' && (
            <div className="space-y-6 fade-in">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase">Total Peserta</p>
                  <p className="text-3xl font-black text-slate-800 mt-1 tabular-nums">
                    {cache.students.length}
                  </p>
                  <p className="text-[11px] text-indigo-600 font-semibold mt-1">
                    {cache.classes.length} Kelas · {cache.rooms.length} Ruang
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase">Bank Soal CBT</p>
                  <p className="text-3xl font-black text-slate-800 mt-1 tabular-nums">
                    {cache.questions.length}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {cache.subjects.length} Mata Pelajaran
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase">Peserta Online</p>
                  <p className="text-3xl font-black text-emerald-600 mt-1 tabular-nums">
                    {onlineNowCount}
                  </p>
                  <p className="text-[11px] text-rose-600 font-semibold mt-1 tabular-nums">
                    {lockedCount} Terkunci Pelanggaran
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase">Hasil Masuk</p>
                  <p className="text-3xl font-black text-slate-800 mt-1 tabular-nums">
                    {cache.results.length}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                    Rata-rata: {avgAllScores}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3">
                  <div>
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <Monitor className="w-5 h-5 text-indigo-600" /> Pengawasan Peserta Live Semua Ruang
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pantauan realtime peserta yang sedang online atau terkunci pelanggaran
                    </p>
                  </div>
                  <select
                    value={activeProctorRoom}
                    onChange={(e) => setActiveProctorRoom(e.target.value)}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold outline-none"
                  >
                    <option value="ALL">Semua Ruang</option>
                    {cache.rooms.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <LiveMonitorTable
                  sessions={cache.activeSessions}
                  roomFilter={activeProctorRoom}
                  onOpenPushMessage={(id, name) => setPushMsgTarget({ id, name })}
                  onGrantExtraTime={handleGrantExtraTime}
                  onSupervisorAction={handleSupervisorAction}
                  onResetLogin={handleResetLogin}
                  onResetExam={handleResetExamFromLive}
                />
              </div>
            </div>
          )}

          {/* KEPSEK OVERVIEW */}
          {currentTab === 'kepsek_overview' && (
            <div className="space-y-6 fade-in">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase">Peserta Terdaftar</p>
                  <p className="text-3xl font-black text-slate-800 mt-1 tabular-nums">
                    {cache.students.length}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase">Jadwal Ujian Aktif</p>
                  <p className="text-3xl font-black text-indigo-600 mt-1 tabular-nums">
                    {cache.exams.filter((e) => e.status === 'aktif').length}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase">Rata-Rata Sekolah</p>
                  <p className="text-3xl font-black text-emerald-600 mt-1 tabular-nums">
                    {avgAllScores}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase">Catatan Pelanggaran</p>
                  <p className="text-3xl font-black text-rose-600 mt-1 tabular-nums">
                    {unifiedViolCount}
                  </p>
                </div>
              </div>
              <KktpAnalysisView cache={cache} />
            </div>
          )}

          {/* KEPSEK LIVE ROOMS & GURU PROCTOR ROOM */}
          {(currentTab === 'kepsek_live_rooms' || currentTab === 'guru_proctor_room') && (
            <div className="space-y-6 fade-in">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Ruang Ujian Aktif
                    </label>
                    <select
                      value={activeProctorRoom}
                      onChange={(e) => setActiveProctorRoom(e.target.value)}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-bold outline-none focus:border-indigo-500"
                    >
                      <option value="ALL">Semua Ruang</option>
                      {cache.rooms.map((r) => (
                        <option key={r.id} value={r.name}>
                          {r.name} (PIN: {r.room_pin || '-'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {activeProctorRoom !== 'ALL' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleRoomPause(activeProctorRoom, true)}
                      className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <Pause className="w-3.5 h-3.5" /> Jeda Ruang
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleRoomPause(activeProctorRoom, false)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" /> Lanjutkan Ruang
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <LiveMonitorTable
                  sessions={cache.activeSessions}
                  roomFilter={activeProctorRoom}
                  onOpenPushMessage={(id, name) => setPushMsgTarget({ id, name })}
                  onGrantExtraTime={handleGrantExtraTime}
                  onSupervisorAction={handleSupervisorAction}
                  onResetLogin={handleResetLogin}
                  onResetExam={handleResetExamFromLive}
                />
              </div>
            </div>
          )}

          {/* GURU OVERVIEW */}
          {currentTab === 'guru_overview' && (
            <div className="space-y-6 fade-in">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
                <div>
                  <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold">
                    Mapel Ampuan: {currentUser.subject || '-'}
                  </span>
                  <h3 className="text-xl font-black text-slate-800 mt-1.5">
                    Selamat Bertugas, {currentUser.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ruang Pengawasan Ditugaskan: {currentUser.proctor_room || 'Belum ditetapkan'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentTab('guru_proctor_room')}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow"
                  >
                    <Monitor className="w-4 h-4" /> Buka Ruang Pengawas
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentTab('bank_soal')}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <BookOpen className="w-4 h-4" /> Kelola Bank Soal
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase">Total Soal Tersedia</p>
                  <p className="text-3xl font-black text-slate-800 mt-1 tabular-nums">
                    {cache.questions.length}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase">Esai Perlu Koreksi</p>
                  <p className="text-3xl font-black text-amber-600 mt-1 tabular-nums">
                    {pendingEssayCount}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase">Peserta Terkunci</p>
                  <p className="text-3xl font-black text-rose-600 mt-1 tabular-nums">
                    {lockedCount}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ADMIN & SHARED SUB-VIEWS */}
          {currentTab === 'admin_school' && (
            <SchoolSettingsView
              school={cache.schoolSettings}
              onSaveSuccess={(updated) =>
                setCache((prev) => ({ ...prev, schoolSettings: updated }))
              }
              setLoading={setLoading}
              showToast={showToast}
            />
          )}

          {currentTab === 'admin_master' && (
            <MasterDataView
              cache={cache}
              onSync={() => syncFromSupabase(currentUser, true)}
              onDeleteRecord={handleDeleteRecord}
              setLoading={setLoading}
              showToast={showToast}
            />
          )}

          {currentTab === 'admin_students' && (
            <StudentsManagerView
              cache={cache}
              onSync={() => syncFromSupabase(currentUser, true)}
              onDeleteRecord={handleDeleteRecord}
              setLoading={setLoading}
              showToast={showToast}
            />
          )}

          {currentTab === 'admin_teachers' && (
            <TeachersManagerView
              cache={cache}
              onSync={() => syncFromSupabase(currentUser, true)}
              onDeleteRecord={handleDeleteRecord}
              setLoading={setLoading}
              showToast={showToast}
            />
          )}

          {currentTab === 'admin_staff' && (
            <StaffManagerView
              cache={cache}
              onSync={() => syncFromSupabase(currentUser, true)}
              onDeleteRecord={handleDeleteRecord}
              setLoading={setLoading}
              showToast={showToast}
            />
          )}

          {currentTab === 'bank_soal' && (
            <QuestionBankView
              cache={cache}
              currentUser={currentUser}
              onSync={() => syncFromSupabase(currentUser, true)}
              onDeleteRecord={handleDeleteRecord}
              setLoading={setLoading}
              showToast={showToast}
            />
          )}

          {currentTab === 'jadwal_ujian' && (
            <ExamScheduleManager
              cache={cache}
              currentUser={currentUser}
              onSync={() => syncFromSupabase(currentUser, true)}
              onDeleteRecord={handleDeleteRecord}
              setLoading={setLoading}
              showToast={showToast}
            />
          )}

          {currentTab === 'reset_center' && (
            <ResetCenterView
              cache={cache}
              currentUser={currentUser}
              activeProctorRoom={activeProctorRoom}
              onSync={() => syncFromSupabase(currentUser, true)}
              onResetLogin={handleResetLogin}
              onRemoveFromAlertQueue={(studentId) =>
                setSupervisorQueue((prev) => prev.filter((item) => item.student_id !== studentId))
              }
              setLoading={setLoading}
              showToast={showToast}
            />
          )}

          {currentTab === 'cards' && <ParticipantCardsView cache={cache} />}
          {currentTab === 'seating' && <SeatingPlanView cache={cache} />}

          {currentTab === 'results' && (
            <ResultsAndBeritaAcaraView
              cache={cache}
              currentUser={currentUser}
              onSync={() => syncFromSupabase(currentUser, true)}
              onDeleteRecord={handleDeleteRecord}
              onPrintDedicated={handlePrintDedicated}
              showToast={showToast}
            />
          )}

          {currentTab === 'essay_grading' && (
            <EssayGradingView
              cache={cache}
              currentUser={currentUser}
              onSync={() => syncFromSupabase(currentUser, true)}
              setLoading={setLoading}
              showToast={showToast}
            />
          )}

          {currentTab === 'kktp' && <KktpAnalysisView cache={cache} />}

          {currentTab === 'violations' && (
            <ViolationsLogView
              cache={cache}
              currentUser={currentUser}
              onSync={() => syncFromSupabase(currentUser, true)}
              setLoading={setLoading}
              showToast={showToast}
            />
          )}

          {currentTab === 'announcements' && (
            <AnnouncementsView
              cache={cache}
              currentUser={currentUser}
              onSync={() => syncFromSupabase(currentUser, true)}
              onDeleteRecord={handleDeleteRecord}
              setLoading={setLoading}
              showToast={showToast}
            />
          )}

          {currentTab === 'backup' && (
            <div className="space-y-6 fade-in">
              <BackupMigrationView
                cache={cache}
                onSync={() => syncFromSupabase(currentUser, true)}
                setLoading={setLoading}
                showToast={showToast}
              />
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-600" /> Skema SQL Database v5.0
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Lihat dan salin skrip SQL pembuatan 15 tabel &amp; RPC Supabase.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSqlModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-2"
                >
                  <Database className="w-4 h-4" /> Buka Skema SQL
                </button>
              </div>
            </div>
          )}

          {/* STUDENT PORTAL & HISTORY */}
          {currentTab === 'student_portal' && (
            <StudentPortalView
              cache={cache}
              currentUser={currentUser}
              onStartExam={(exam) => setActiveExam(exam)}
              showToast={showToast}
            />
          )}

          {currentTab === 'student_history' && (
            <StudentHistoryView cache={cache} currentUser={currentUser} />
          )}
        </main>
      </div>

      {/* Dedicated Print Wrapper (for Berita Acara) */}
      <div id="dedicated-print-wrapper" className="hidden print:block">
        {dedicatedPrintNode}
      </div>
    </div>
  );
}
