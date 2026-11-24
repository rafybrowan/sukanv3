// ===== Tipe data bersama (client & server) =====

export type ScheduleStatus = 'AKTIF' | 'DITUTUP' | 'DITUNDA';
export type GroupingOption = 'WAIT_GROUP' | 'DEPART_NOW' | 'COMPLETE';
export type ReservationStatus = 'MENUNGGU_PEMBAYARAN' | 'TERKONFIRMASI' | 'SELESAI' | 'DIBATALKAN';
export type GroupingStatus = 'MENUNGGU_PENGELOMPOKAN' | 'SIAP_BERANGKAT' | 'KELOMPOK_LENGKAP' | 'TERKELOMPOK';
export type PaymentMethod = 'FULL_PAYMENT' | 'ONSITE';
export type PaymentStatus = 'UNPAID' | 'PAID';
export type ScheduleAvailability = 'TERSEDIA' | 'HAMPIR_PENUH' | 'PENUH' | 'DITUTUP' | 'DITUNDA';
export type GuideStatus = 'TERSEDIA' | 'DITUGASKAN' | 'TIDAK_AKTIF';
export type AssignmentStatus = 'BELUM_DITUGASKAN' | 'DITUGASKAN' | 'SELESAI' | 'DIBATALKAN';
export type HonorStatus = 'BELUM_DIPROSES' | 'SIAP_DIBAYARKAN' | 'SUDAH_DIBAYARKAN';
export type GroupProgressStatus = 'NEW' | 'IN_PROGRESS' | 'DONE';
export type GroupConditionStatus = 'NORMAL' | 'PENDING' | 'OVERDUE';
export type HistoryChangeType = 'PROGRESS' | 'CONDITION' | 'EVENT';

export interface ScheduleStats {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  capacity: number;
  status: ScheduleStatus;
  currentParticipants: number;
  remaining: number;
  utilization: number; // 0-100
  availability: ScheduleAvailability;
  reservationCount: number;
}

export interface PaymentDTO {
  id: string;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  amountPaid: number;
  remainingAmount: number;
  paymentStatus: PaymentStatus;
  transactionCode: string | null;
  paidAt: string | null;
  createdAt: string;
  history?: PaymentHistoryDTO[];
}

export interface PaymentHistoryDTO {
  id: string;
  amount: number;
  type: string;
  transactionCode: string | null;
  note: string | null;
  createdAt: string;
}

export interface GroupMemberDTO {
  id: string;
  participantCount: number;
  reservation: {
    id: string;
    reservationCode: string;
    name: string;
    participantCount: number;
    phone: string;
    reservationStatus?: string;
    createdAt?: string;
    payment?: {
      paymentMethod: string;
      paymentStatus: string;
      totalAmount: number;
      amountPaid: number;
      remainingAmount: number;
    } | null;
  };
}

export interface GroupStatusHistoryDTO {
  id: string;
  changeType: HistoryChangeType;
  previousStatus: string | null;
  newStatus: string;
  changedBy: string;
  note: string | null;
  createdAt: string;
}

export interface GroupDTO {
  id: string;
  groupCode: string;
  status: string;
  progressStatus: GroupProgressStatus;
  conditionStatus: GroupConditionStatus;
  scheduleId?: string;
  schedule: { date: string; time: string };
  createdAt: string;
  /** aktivitas terakhir (dibuat/riwayat/penugasan) — untuk "terakhir diperbarui" */
  lastActivity?: string;
  /** waktu pengelompokan ditandai selesai (riwayat PROGRESS -> DONE terakhir) */
  doneAt?: string | null;
  members: GroupMemberDTO[];
  totalParticipants: number;
  mainCustomer?: string | null;
  mainReservationCode?: string | null;
  paymentSummary?: {
    paidCount: number;
    totalCount: number;
    allPaid: boolean;
    unpaidCount: number;
    label: string;
  };
  statusHistory?: GroupStatusHistoryDTO[];
  guideAssignment?: GuideAssignmentLiteDTO | null;
}

/** Reservasi yang belum terkelompokkan — kartu di kolom TERBARU. */
export interface UngroupedReservationDTO {
  id: string;
  reservationCode: string;
  name: string;
  phone: string;
  participantCount: number;
  groupingStatus: string;
  groupingOption: string;
  reservationStatus: string;
  totalPrice: number;
  scheduleId: string;
  date: string;
  time: string;
  condition: GroupConditionStatus;
  payment: {
    paymentMethod: string;
    paymentStatus: string;
    totalAmount: number;
    amountPaid: number;
    remainingAmount: number;
  } | null;
  scheduleCapacity: { capacity: number; used: number; remaining: number };
  createdAt: string;
  updatedAt: string;
}

// ===== Modul Pemandu / Guide =====
export interface GuideDTO {
  id: string;
  guideCode: string;
  name: string;
  phone: string;
  rate: number;
  status: GuideStatus;
  notes: string | null;
  createdAt: string;
  currentAssignment: {
    id: string;
    groupCode: string;
    date: string;
    time: string;
    participantCount: number;
  } | null;
  totalAssignments: number;
  completedAssignments: number;
  totalHonor: number;
  /** khusus modal penugasan: ketersediaan utk jadwal tertentu */
  availableForSchedule?: boolean;
  unavailableReason?: string | null;
}

export interface GuideAssignmentLiteDTO {
  id: string;
  guideId: string;
  guideCode: string;
  guideName: string;
  guidePhone: string;
  guideStatus?: string;
  assignmentStatus: AssignmentStatus;
  paymentStatus: HonorStatus;
  rate: number;
  participantCount: number;
  assignmentDate: string;
  startTime: string;
  assignedAt: string;
  completedAt: string | null;
  groupCode: string;
}

export interface GuideAssignmentDTO extends GuideAssignmentLiteDTO {
  scheduleId: string;
}

export interface ChangeRequestDTO {
  id: string;
  type: string;
  requestedChange: string;
  reason: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  reservation: {
    reservationCode: string;
    name: string;
    phone: string;
  };
}

export interface ReservationDTO {
  id: string;
  reservationCode: string;
  name: string;
  phone: string;
  email: string | null;
  participantCount: number;
  paymentParticipantCount: number;
  groupingOption: GroupingOption;
  reservationStatus: ReservationStatus;
  groupingStatus: GroupingStatus;
  totalPrice: number;
  actualParticipantCount: number | null;
  createdAt: string;
  schedule: {
    id: string;
    date: string;
    time: string;
    capacity: number;
    status: ScheduleStatus;
  };
  payment: PaymentDTO | null;
  group?: { groupCode: string; status: string } | null;
  groupMembers?: { name: string; participantCount: number; groupCode: string }[];
  changeRequests?: ChangeRequestDTO[];
}

export interface AppSettings {
  pricePerPerson: number;
  idealGroupSize: number;
  location: string;
}

export interface RecommendationDTO {
  id: string;
  type: 'IDEAL' | 'PARTIAL' | 'ADD_TO_GROUP';
  scheduleId: string;
  scheduleLabel: string; // "Sabtu, 27 Sep 2026 · 09:00"
  reservations: { id: string; reservationCode: string; name: string; participantCount: number }[];
  totalParticipants: number;
  targetGroupCode?: string;
  message: string;
}
