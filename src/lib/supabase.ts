import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  ExamResult,
  ExamSchedule,
  Question,
  QuestionType,
  SchoolClass,
  SchoolSettings,
  ExamRoom,
  ExamSession,
  Subject,
} from '../types/cbt';

export const SUPABASE_URL = 'https://zhhtwopsleuobavxwprp.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_VhSgqeaPJWnMcOwXE49miA_a7n9HvFH';
export const STORAGE_MEDIA_BUCKET = 'cbt-media';

export const supabaseClient: SupabaseClient | null =
  SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export function ensureSupabase(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error('Koneksi ke server Supabase belum siap. Periksa jaringan internet Anda.');
  }
  return supabaseClient;
}

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  id: 'main',
  school_name: 'SMP NEGERI 2 GREGED',
  npsn: '20214891',
  education_office: 'PEMERINTAH KABUPATEN CIREBON • DINAS PENDIDIKAN',
  address: 'Jl. Raya Greged No. 45, Kec. Greged, Kab. Cirebon',
  city: 'Cirebon',
  academic_year: '2026 / 2027',
  semester: 'Genap',
  principal_name: 'Drs. H. Ahmad Sudrajat, M.Pd.',
  principal_nip: 'NIP. 19680512 199412 1 002',
  committee_head: 'Budi Santoso, S.Pd., M.Pd.',
  committee_nip: 'NIP. 19800315 200604 1 008',
  logo_url: '',
};

export const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'def_sub_1', code: 'MTK', name: 'Matematika', kktp: 75 },
  { id: 'def_sub_2', code: 'BIN', name: 'Bahasa Indonesia', kktp: 75 },
  { id: 'def_sub_3', code: 'IPA', name: 'Ilmu Pengetahuan Alam (IPA)', kktp: 75 },
  { id: 'def_sub_4', code: 'BIG', name: 'Bahasa Inggris', kktp: 75 },
];

export const DEFAULT_CLASSES: SchoolClass[] = [
  { id: 'def_cls_1', name: 'VII A', grade_level: 'Tingkat VII' },
  { id: 'def_cls_2', name: 'VIII A', grade_level: 'Tingkat VIII' },
  { id: 'def_cls_3', name: 'IX A', grade_level: 'Tingkat IX' },
];

export const DEFAULT_ROOMS: ExamRoom[] = [
  { id: 'def_rm_1', name: 'Ruang 01', location: 'Gedung A Lt. 1', capacity: 32, room_pin: 'R01-101' },
  { id: 'def_rm_2', name: 'Ruang 02', location: 'Gedung A Lt. 1', capacity: 32, room_pin: 'R02-102' },
];

export const DEFAULT_SESSIONS: ExamSession[] = [
  { id: 'def_ses_1', name: 'Sesi 1', time_range: '07.30 - 09.30 WIB' },
  { id: 'def_ses_2', name: 'Sesi 2', time_range: '10.00 - 12.00 WIB' },
];

export function extractQuestionAudioMeta(rawQuestionText: string) {
  const str = String(rawQuestionText || '');
  const match = str.match(/\[\[AUDIO:([^\|\]]+)(?:\|MAX:(\d+))?\]\]/i);
  if (!match) {
    return { cleanText: str, audioUrl: '', maxPlays: 2 };
  }
  const cleanText = str.replace(match[0], '').trim();
  return {
    cleanText,
    audioUrl: match[1].trim(),
    maxPlays: match[2] !== undefined ? Math.max(0, parseInt(match[2], 10)) : 2,
  };
}

export function normalizeQuestionFromRow(row: Record<string, unknown>): Question {
  const parsedOpts = Array.isArray(row.options) ? (row.options as string[]) : [];
  const rawQ = String(row.question || '');
  const audioMeta = extractQuestionAudioMeta(rawQ);

  return {
    id: String(row.id || ''),
    subject: String(row.subject || ''),
    packetCode: String(row.packet_code || 'UMUM'),
    type: (row.question_type as QuestionType) || 'pg',
    question: audioMeta.cleanText,
    audioUrl: String(row.audio_url || audioMeta.audioUrl || ''),
    audioMaxPlays:
      row.audio_max_plays !== undefined && row.audio_max_plays !== null
        ? Number(row.audio_max_plays)
        : audioMeta.maxPlays,
    image: String(row.image || ''),
    options: parsedOpts,
    answer: row.answer,
    essayGradingMode: row.essay_grading_mode === 'manual' ? 'manual' : 'auto',
    questionWeight: Number(row.question_weight) || 1,
    sharedMgmp: row.shared_mgmp !== false,
    createdByName: String(row.created_by_name || 'Guru Mapel'),
  };
}

export function normalizeExamFromRow(row: Record<string, unknown>): ExamSchedule {
  return {
    id: String(row.id || ''),
    title: String(row.title || ''),
    subject: String(row.subject || ''),
    packetCode: String(row.packet_code || 'SEMUA'),
    targetClass: String(row.target_class || 'SEMUA'),
    targetSession: String(row.target_session || 'SEMUA'),
    duration: Number(row.duration) || 60,
    maxQuestions: Number(row.max_questions) || 0,
    token: String(row.token || ''),
    status: row.status === 'nonaktif' ? 'nonaktif' : 'aktif',
    randomize: Boolean(row.randomize),
    randomizeOptions: row.randomize_options !== false,
    requireProctorPin: Boolean(row.require_proctor_pin),
    showResult: row.show_result !== false,
    maxViolations:
      row.max_violations !== undefined && row.max_violations !== null
        ? Number(row.max_violations)
        : 3,
    sourceType: row.source_type === 'gform' ? 'gform' : 'internal',
    gformUrl: String(row.gform_url || ''),
    examMode: row.exam_mode === 'relaxed' ? 'relaxed' : 'strict',
    startTime: row.start_time ? String(row.start_time) : null,
    endTime: row.end_time ? String(row.end_time) : null,
    createdBy: String(row.created_by || ''),
  };
}

export function normalizeResultFromRow(row: Record<string, unknown>): ExamResult {
  return {
    id: String(row.id || ''),
    examId: String(row.exam_id || ''),
    examTitle: String(row.exam_title || ''),
    subject: String(row.subject || ''),
    studentId: String(row.student_id || ''),
    studentName: String(row.student_name || ''),
    studentIdentity: String(row.student_identity || ''),
    studentClass: String(row.student_class || ''),
    score: Number(row.score) || 0,
    correctCount: Number(row.correct_count) || 0,
    totalQuestions: Number(row.total_questions) || 0,
    violations: Number(row.violations) || 0,
    submittedAt: String(row.submitted_at || ''),
    answersDetail: (row.answers_detail as Record<string, unknown>) || {},
    gradingStatus: String(row.grading_status || 'graded'),
    manualEssayScores: (row.manual_essay_scores as Record<string, number>) || {},
  };
}

export async function uploadMediaToSupabaseStorage(
  blobOrFile: File | Blob,
  folder = 'images',
  ext = 'jpg'
): Promise<string | null> {
  if (!supabaseClient) return null;
  try {
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabaseClient.storage
      .from(STORAGE_MEDIA_BUCKET)
      .upload(fileName, blobOrFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: blobOrFile.type || (ext === 'jpg' ? 'image/jpeg' : 'audio/mpeg'),
      });
    if (error) return null;
    const { data } = supabaseClient.storage.from(STORAGE_MEDIA_BUCKET).getPublicUrl(fileName);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}

export const SUPABASE_SQL_V5 = `-- ============================================================================
-- SKEMA DATABASE SUPABASE EDU-CBT PRO v5.0 (TABEL TERPISAH & TERNORMALISASI)
-- Dilengkapi Validasi Keunikan Username Lintas 3 Tabel Akun & Keamanan Login
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TABEL IDENTITAS & KOP SEKOLAH
CREATE TABLE IF NOT EXISTS public.cbt_school_settings (
    id TEXT PRIMARY KEY DEFAULT 'main',
    school_name TEXT NOT NULL DEFAULT 'SMP NEGERI 2 GREGED',
    npsn TEXT DEFAULT '20214891',
    education_office TEXT DEFAULT 'PEMERINTAH KABUPATEN CIREBON • DINAS PENDIDIKAN',
    address TEXT DEFAULT 'Jl. Raya Greged No. 45, Kec. Greged, Kab. Cirebon',
    city TEXT DEFAULT 'Cirebon',
    academic_year TEXT DEFAULT '2026 / 2027',
    semester TEXT DEFAULT 'Genap',
    principal_name TEXT DEFAULT 'Drs. H. Ahmad Sudrajat, M.Pd.',
    principal_nip TEXT DEFAULT 'NIP. 19680512 199412 1 002',
    committee_head TEXT DEFAULT 'Budi Santoso, S.Pd., M.Pd.',
    committee_nip TEXT DEFAULT 'NIP. 19800315 200604 1 008',
    logo_url TEXT DEFAULT ''
);

-- 2. TABEL MASTER MATA PELAJARAN (cbt_subjects)
CREATE TABLE IF NOT EXISTS public.cbt_subjects (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL UNIQUE,
    kktp INTEGER NOT NULL DEFAULT 75,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL MASTER KELAS (cbt_classes)
CREATE TABLE IF NOT EXISTS public.cbt_classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    grade_level TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABEL MASTER RUANG UJIAN (cbt_rooms)
CREATE TABLE IF NOT EXISTS public.cbt_rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    location TEXT DEFAULT '',
    capacity INTEGER NOT NULL DEFAULT 32,
    room_pin TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABEL MASTER SESI UJIAN (cbt_sessions)
CREATE TABLE IF NOT EXISTS public.cbt_sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    time_range TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABEL KONFIGURASI PAKET SOAL (cbt_question_packets)
CREATE TABLE IF NOT EXISTS public.cbt_question_packets (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    packet_code TEXT NOT NULL,
    source_type TEXT DEFAULT 'internal',
    gform_url TEXT DEFAULT '',
    randomize BOOLEAN DEFAULT TRUE,
    randomize_options BOOLEAN DEFAULT TRUE,
    updated_by TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subject, packet_code)
);

-- 7. TABEL PESERTA UJIAN / SISWA (cbt_students)
CREATE TABLE IF NOT EXISTS public.cbt_students (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    nisn TEXT NOT NULL UNIQUE,
    kelas TEXT NOT NULL DEFAULT 'VII A',
    exam_room TEXT NOT NULL DEFAULT 'Ruang 01',
    exam_session TEXT NOT NULL DEFAULT 'Sesi 1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABEL GURU PENGAJAR & PENGAWAS (cbt_teachers)
CREATE TABLE IF NOT EXISTS public.cbt_teachers (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    nip TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '-',
    proctor_room TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABEL ADMINISTRATOR & KEPALA SEKOLAH (cbt_staff)
CREATE TABLE IF NOT EXISTS public.cbt_staff (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'kepsek')),
    name TEXT NOT NULL,
    nip TEXT NOT NULL DEFAULT '-',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. TABEL BANK SOAL (cbt_questions)
CREATE TABLE IF NOT EXISTS public.cbt_questions (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    packet_code TEXT DEFAULT 'PAKET-A',
    question_type TEXT DEFAULT 'pg',
    question TEXT NOT NULL,
    image TEXT DEFAULT '',
    audio_url TEXT DEFAULT '',
    audio_max_plays INTEGER DEFAULT 2,
    options JSONB DEFAULT '[]'::jsonb,
    answer JSONB,
    essay_grading_mode TEXT DEFAULT 'auto',
    question_weight INTEGER DEFAULT 1,
    shared_mgmp BOOLEAN DEFAULT TRUE,
    created_by_name TEXT DEFAULT 'Guru',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cbt_questions ADD COLUMN IF NOT EXISTS audio_url TEXT DEFAULT '';
ALTER TABLE public.cbt_questions ADD COLUMN IF NOT EXISTS audio_max_plays INTEGER DEFAULT 2;

CREATE OR REPLACE VIEW public.cbt_questions_student_view AS
SELECT id, subject, packet_code, question_type, question, image, audio_url, audio_max_plays, options, question_weight
FROM public.cbt_questions;

-- 11. TABEL JADWAL UJIAN (cbt_exams)
CREATE TABLE IF NOT EXISTS public.cbt_exams (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    packet_code TEXT DEFAULT 'SEMUA',
    target_class TEXT DEFAULT 'SEMUA',
    target_session TEXT DEFAULT 'SEMUA',
    duration INTEGER DEFAULT 60,
    max_questions INTEGER DEFAULT 0,
    token TEXT NOT NULL,
    status TEXT DEFAULT 'aktif',
    randomize BOOLEAN DEFAULT TRUE,
    randomize_options BOOLEAN DEFAULT TRUE,
    require_proctor_pin BOOLEAN DEFAULT FALSE,
    show_result BOOLEAN DEFAULT TRUE,
    max_violations INTEGER DEFAULT 3,
    source_type TEXT DEFAULT 'internal',
    gform_url TEXT DEFAULT '',
    exam_mode TEXT DEFAULT 'strict',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    created_by TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cbt_exams ADD COLUMN IF NOT EXISTS max_violations INTEGER DEFAULT 3;

-- 12. TABEL HASIL & NILAI UJIAN (cbt_results)
CREATE TABLE IF NOT EXISTS public.cbt_results (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL,
    exam_title TEXT NOT NULL,
    subject TEXT NOT NULL,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    student_identity TEXT NOT NULL,
    student_class TEXT NOT NULL,
    score NUMERIC(6,2) DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    violations INTEGER DEFAULT 0,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    answers_detail JSONB DEFAULT '{}'::jsonb,
    grading_status TEXT DEFAULT 'graded',
    manual_essay_scores JSONB DEFAULT '{}'::jsonb
);

-- 13. TABEL SESI ONLINE & PENGAWASAN LIVE (cbt_active_sessions)
CREATE TABLE IF NOT EXISTS public.cbt_active_sessions (
    student_id TEXT PRIMARY KEY,
    student_name TEXT NOT NULL,
    student_identity TEXT NOT NULL,
    student_class TEXT NOT NULL,
    exam_room TEXT DEFAULT 'Ruang 01',
    status TEXT DEFAULT 'ONLINE_PORTAL',
    exam_title TEXT DEFAULT '-',
    progress TEXT DEFAULT '-',
    violations INTEGER DEFAULT 0,
    saved_answers JSONB DEFAULT '{}'::jsonb,
    time_left_seconds INTEGER DEFAULT 0,
    force_action TEXT DEFAULT '',
    extra_minutes INTEGER DEFAULT 0,
    supervisor_message TEXT DEFAULT '',
    is_paused BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- 14. TABEL PENGUMUMAN & TATA TERTIB (cbt_announcements)
CREATE TABLE IF NOT EXISTS public.cbt_announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'INFO',
    content TEXT NOT NULL,
    target_role TEXT DEFAULT 'semua',
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT DEFAULT 'Panitia',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. TABEL CATATAN LOG PELANGGARAN PESERTA (cbt_violation_logs)
CREATE TABLE IF NOT EXISTS public.cbt_violation_logs (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    student_identity TEXT NOT NULL,
    student_class TEXT NOT NULL,
    exam_room TEXT DEFAULT '',
    exam_id TEXT DEFAULT '',
    exam_title TEXT DEFAULT '-',
    subject TEXT DEFAULT '-',
    reason TEXT NOT NULL,
    violation_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FUNGSI RPC AUTENTIKASI LINTAS 3 TABEL AKUN
CREATE OR REPLACE FUNCTION public.cbt_authenticate_user(p_username TEXT, p_password TEXT)
RETURNS TABLE (
    id TEXT,
    username TEXT,
    role TEXT,
    name TEXT,
    identity TEXT,
    kelas TEXT,
    subject TEXT,
    exam_room TEXT,
    exam_session TEXT,
    proctor_room TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.username, 'siswa'::TEXT, s.name, s.nisn, s.kelas, '-'::TEXT, s.exam_room, s.exam_session, ''::TEXT
    FROM public.cbt_students s
    WHERE (LOWER(s.username) = LOWER(p_username) OR LOWER(s.nisn) = LOWER(p_username))
      AND s.password = p_password
    UNION ALL
    SELECT t.id, t.username, 'guru'::TEXT, t.name, t.nip, '-'::TEXT, t.subject, '-'::TEXT, '-'::TEXT, COALESCE(t.proctor_room, '')
    FROM public.cbt_teachers t
    WHERE (LOWER(t.username) = LOWER(p_username) OR LOWER(t.nip) = LOWER(p_username))
      AND t.password = p_password
    UNION ALL
    SELECT st.id, st.username, st.role, st.name, st.nip, '-'::TEXT, '-'::TEXT, '-'::TEXT, '-'::TEXT, 'ALL'::TEXT
    FROM public.cbt_staff st
    WHERE (LOWER(st.username) = LOWER(p_username) OR LOWER(st.nip) = LOWER(p_username))
      AND st.password = p_password;
END;
$$;

-- FUNGSI RPC UBAH PASSWORD MANDIRI
CREATE OR REPLACE FUNCTION public.cbt_change_own_password(p_user_id TEXT, p_old_password TEXT, p_new_password TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    updated_rows INTEGER := 0;
BEGIN
    UPDATE public.cbt_students SET password = p_new_password WHERE id = p_user_id AND password = p_old_password;
    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    IF updated_rows > 0 THEN RETURN TRUE; END IF;

    UPDATE public.cbt_teachers SET password = p_new_password WHERE id = p_user_id AND password = p_old_password;
    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    IF updated_rows > 0 THEN RETURN TRUE; END IF;

    UPDATE public.cbt_staff SET password = p_new_password WHERE id = p_user_id AND password = p_old_password;
    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    RETURN updated_rows > 0;
END;
$$;

-- FUNGSI RPC PENILAIAN OTOMATIS & SIMPAN HASIL UJIAN
CREATE OR REPLACE FUNCTION public.cbt_grade_and_submit_exam(
    p_exam_id TEXT,
    p_student_id TEXT,
    p_student_name TEXT,
    p_student_identity TEXT,
    p_student_class TEXT,
    p_question_ids TEXT[],
    p_answers JSONB,
    p_violations INTEGER DEFAULT 0
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_exam RECORD;
    v_q RECORD;
    v_ans JSONB;
    v_ans_str TEXT;
    v_key_str TEXT;
    v_total_weight NUMERIC := 0;
    v_earned_weight NUMERIC := 0;
    v_correct_count INTEGER := 0;
    v_total_q INTEGER := 0;
    v_has_manual_essay BOOLEAN := FALSE;
    v_final_score NUMERIC(6,2) := 0;
    v_res_id TEXT;
BEGIN
    SELECT id, score INTO v_res_id, v_final_score
    FROM public.cbt_results
    WHERE exam_id = p_exam_id AND student_id = p_student_id
    LIMIT 1;

    IF v_res_id IS NOT NULL THEN
        RETURN jsonb_build_object('result_id', v_res_id, 'score', v_final_score);
    END IF;

    SELECT * INTO v_exam FROM public.cbt_exams WHERE id = p_exam_id;

    FOR v_q IN SELECT * FROM public.cbt_questions WHERE id = ANY(p_question_ids)
    LOOP
        v_total_q := v_total_q + 1;
        v_total_weight := v_total_weight + COALESCE(v_q.question_weight, 1);
        v_ans := p_answers -> v_q.id;

        IF v_q.question_type = 'pg' THEN
            IF v_ans IS NOT NULL AND jsonb_typeof(v_ans) <> 'null' AND v_q.answer IS NOT NULL AND jsonb_typeof(v_q.answer) <> 'null' THEN
                v_ans_str := TRIM(BOTH '"' FROM v_ans::TEXT);
                v_key_str := TRIM(BOTH '"' FROM v_q.answer::TEXT);
                IF v_ans_str ~ '^\\d+$' AND v_key_str ~ '^\\d+$' AND v_ans_str::INTEGER = v_key_str::INTEGER THEN
                    v_correct_count := v_correct_count + 1;
                    v_earned_weight := v_earned_weight + COALESCE(v_q.question_weight, 1);
                END IF;
            END IF;
        ELSIF v_q.question_type = 'pgk' THEN
            IF v_ans IS NOT NULL AND jsonb_typeof(v_ans) = 'array' AND v_q.answer IS NOT NULL AND jsonb_typeof(v_q.answer) = 'array' THEN
                IF v_ans @> v_q.answer AND v_q.answer @> v_ans THEN
                    v_correct_count := v_correct_count + 1;
                    v_earned_weight := v_earned_weight + COALESCE(v_q.question_weight, 1);
                END IF;
            END IF;
        ELSIF v_q.question_type = 'bs' THEN
            IF v_ans IS NOT NULL AND jsonb_typeof(v_ans) <> 'null' AND v_q.answer IS NOT NULL THEN
                IF LOWER(TRIM(BOTH '"' FROM v_ans::TEXT)) = LOWER(TRIM(BOTH '"' FROM v_q.answer::TEXT)) THEN
                    v_correct_count := v_correct_count + 1;
                    v_earned_weight := v_earned_weight + COALESCE(v_q.question_weight, 1);
                END IF;
            END IF;
        ELSIF v_q.question_type = 'esai' THEN
            IF COALESCE(v_q.essay_grading_mode, 'auto') = 'manual' THEN
                v_has_manual_essay := TRUE;
            ELSIF v_ans IS NOT NULL AND jsonb_typeof(v_ans) <> 'null' AND v_q.answer IS NOT NULL THEN
                IF LOWER(TRIM(BOTH '"' FROM v_ans::TEXT)) = LOWER(TRIM(BOTH '"' FROM v_q.answer::TEXT)) THEN
                    v_correct_count := v_correct_count + 1;
                    v_earned_weight := v_earned_weight + COALESCE(v_q.question_weight, 1);
                END IF;
            END IF;
        END IF;
    END LOOP;

    IF v_total_weight > 0 THEN
        v_final_score := ROUND((v_earned_weight / v_total_weight) * 100, 2);
    END IF;

    v_res_id := 'res_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || p_student_id;

    INSERT INTO public.cbt_results (
        id, exam_id, exam_title, subject, student_id, student_name, student_identity, student_class,
        score, correct_count, total_questions, violations, submitted_at, answers_detail, grading_status
    ) VALUES (
        v_res_id, p_exam_id, COALESCE(v_exam.title, 'Ujian CBT'), COALESCE(v_exam.subject, '-'),
        p_student_id, p_student_name, p_student_identity, p_student_class,
        v_final_score, v_correct_count, v_total_q, COALESCE(p_violations, 0), NOW(), p_answers,
        CASE WHEN v_has_manual_essay THEN 'pending_essay' ELSE 'graded' END
    );

    RETURN jsonb_build_object('result_id', v_res_id, 'score', v_final_score);
END;
$$;

INSERT INTO public.cbt_staff (id, username, password, role, name, nip)
VALUES ('stf_admin_default', 'admin', 'admin123', 'admin', 'Administrator Sistem', '19800101 200501 1 001')
ON CONFLICT (id) DO NOTHING;`;
