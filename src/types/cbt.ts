export type UserRole = 'admin' | 'kepsek' | 'guru' | 'siswa';

export interface UserSession {
  id: string;
  username: string;
  role: UserRole;
  name: string;
  identity: string;
  kelas: string;
  subject: string;
  exam_room: string;
  exam_session: string;
  proctor_room: string;
}

export interface SchoolSettings {
  id: string;
  school_name: string;
  npsn: string;
  education_office: string;
  address: string;
  city: string;
  academic_year: string;
  semester: string;
  principal_name: string;
  principal_nip: string;
  committee_head: string;
  committee_nip: string;
  logo_url: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  kktp: number;
}

export interface SchoolClass {
  id: string;
  name: string;
  grade_level: string;
}

export interface ExamRoom {
  id: string;
  name: string;
  location: string;
  capacity: number;
  room_pin: string;
}

export interface ExamSession {
  id: string;
  name: string;
  time_range: string;
}

export interface QuestionPacket {
  id: string;
  subject: string;
  packet_code: string;
  source_type: string;
  gform_url: string;
  randomize: boolean;
  randomize_options: boolean;
  updated_by: string;
}

export interface StudentRecord {
  id: string;
  username: string;
  password: string;
  name: string;
  nisn: string;
  kelas: string;
  exam_room: string;
  exam_session: string;
}

export interface TeacherRecord {
  id: string;
  username: string;
  password?: string;
  name: string;
  nip: string;
  subject: string;
  proctor_room: string;
}

export interface StaffRecord {
  id: string;
  username: string;
  password?: string;
  role: 'admin' | 'kepsek';
  name: string;
  nip: string;
}

export type QuestionType = 'pg' | 'pgk' | 'bs' | 'esai';

export interface Question {
  id: string;
  subject: string;
  packetCode: string;
  type: QuestionType;
  question: string;
  image: string;
  audioUrl: string;
  audioMaxPlays: number;
  options: string[];
  answer: unknown;
  essayGradingMode: 'auto' | 'manual';
  questionWeight: number;
  sharedMgmp: boolean;
  createdByName: string;
}

export interface ExamSchedule {
  id: string;
  title: string;
  subject: string;
  packetCode: string;
  targetClass: string;
  targetSession: string;
  duration: number;
  maxQuestions: number;
  token: string;
  status: 'aktif' | 'nonaktif';
  randomize: boolean;
  randomizeOptions: boolean;
  requireProctorPin: boolean;
  showResult: boolean;
  maxViolations: number;
  sourceType: 'internal' | 'gform';
  gformUrl: string;
  examMode: 'strict' | 'relaxed';
  startTime: string | null;
  endTime: string | null;
  createdBy: string;
}

export interface ExamResult {
  id: string;
  examId: string;
  examTitle: string;
  subject: string;
  studentId: string;
  studentName: string;
  studentIdentity: string;
  studentClass: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  violations: number;
  submittedAt: string;
  answersDetail: Record<string, unknown>;
  gradingStatus: string;
  manualEssayScores: Record<string, number>;
}

export interface ActiveSession {
  student_id: string;
  student_name: string;
  student_identity: string;
  student_class: string;
  exam_room: string;
  status: string;
  exam_title: string;
  progress: string;
  violations: number;
  saved_answers: Record<string, unknown>;
  time_left_seconds: number;
  force_action: string;
  extra_minutes: number;
  supervisor_message: string;
  is_paused: boolean;
  last_seen: string;
}

export interface Announcement {
  id: string;
  title: string;
  category: string;
  content: string;
  target_role: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface ViolationLog {
  id: string;
  student_id: string;
  student_name: string;
  student_identity: string;
  student_class: string;
  exam_room: string;
  exam_id: string;
  exam_title: string;
  subject: string;
  reason: string;
  violation_count: number;
  created_at: string;
}

export interface AppCache {
  schoolSettings: SchoolSettings;
  subjects: Subject[];
  classes: SchoolClass[];
  rooms: ExamRoom[];
  sessions: ExamSession[];
  questionPackets: QuestionPacket[];
  students: StudentRecord[];
  teachers: TeacherRecord[];
  staff: StaffRecord[];
  questions: Question[];
  exams: ExamSchedule[];
  results: ExamResult[];
  activeSessions: ActiveSession[];
  announcements: Announcement[];
  violationLogs: ViolationLog[];
}

export interface SupervisorAlertItem {
  ackKey: string;
  student_id: string;
  student_name: string;
  student_class: string;
  exam_room: string;
  exam_title: string;
  violations: number;
  status: string;
  reason: string;
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}
