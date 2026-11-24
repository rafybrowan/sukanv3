'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, Clock, History, LifeBuoy, Loader2,
  Phone, Repeat, Tag, Trash2, TriangleAlert, UserRound, Users, UsersRound, Wallet, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge, PaymentMethodBadge, PaymentStatusBadge } from '@/components/app/shared/StatusBadge';
import {
  PROGRESS_STATUS_LABEL, PROGRESS_STATUS_DESC, CONDITION_STATUS_LABEL, CONDITION_STATUS_DESC,
  formatDateID, formatDateTimeID, formatPhone, formatRupiah, formatRelative,
} from '@/lib/format';
import type { GroupDTO, GroupProgressStatus, GroupConditionStatus } from '@/lib/types';

interface Props {
  group: GroupDTO | null;
  idealGroupSize?: number;
  busy?: string;
  onClose: () => void;
  onSetProgress: (g: GroupDTO, status: GroupProgressStatus, note: string) => Promise<boolean>;
  onSetCondition: (g: GroupDTO, condition: GroupConditionStatus, note: string) => Promise<boolean>;
  onFinalize: (g: GroupDTO) => void;
  onAssign: (g: GroupDTO, mode: 'assign' | 'change') => void;
  onComplete: (g: GroupDTO) => void;
  onDisband: (g: GroupDTO) => void;
}

/** Target progress yang sah sesuai aturan alur (harus sama dengan validasi server). */
function validProgressTargets(current: GroupProgressStatus): GroupProgressStatus[] {
  if (current === 'NEW') return ['IN_PROGRESS'];
  if (current === 'IN_PROGRESS') return ['DONE'];
  return ['IN_PROGRESS']; // DONE hanya dapat dibuka kembali
}

/** Timeline riwayat progress pengelompokan (kronologis: terlama di atas). */
function HistoryTimeline({ group }: { group: GroupDTO }) {
  const entries = [...(group.statusHistory ?? [])].reverse();
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada riwayat perubahan status.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l-2 border-muted pl-5">
      {entries.map((h, i) => {
        const isLast = i === entries.length - 1;
        const isCondition = h.changeType === 'CONDITION';
        const isEvent = h.changeType === 'EVENT';
        return (
          <li key={h.id} className="relative">
            <span
              className={`absolute -left-[27px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background ${
                isLast
                  ? isCondition && h.newStatus === 'OVERDUE' ? 'bg-rose-500'
                    : isLast ? 'bg-primary' : 'bg-muted-foreground/40'
                  : isEvent ? 'bg-muted-foreground/25' : 'bg-muted-foreground/40'
              }`}
            />
            {isEvent ? (
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{h.note ?? 'Aktivitas pengelompokan'}</span>
              </p>
            ) : isCondition ? (
              <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Kondisi:</span>
                {h.previousStatus && (
                  <>
                    <StatusBadge kind="condition" status={h.previousStatus} className="text-[10px]" />
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </>
                )}
                <StatusBadge kind="condition" status={h.newStatus} className="text-[10px]" />
              </p>
            ) : (
              <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                {h.previousStatus && (
                  <>
                    <StatusBadge kind="progress" status={h.previousStatus} className="text-[10px]" />
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </>
                )}
                <StatusBadge kind="progress" status={h.newStatus} className="text-[10px]" />
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateTimeID(h.createdAt)} · oleh <b>{h.changedBy}</b>
            </p>
            {h.note && !isEvent && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{h.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Dialog detail pengelompokan: informasi reservasi, keberangkatan, pengelompokan,
 * pemandu, pembayaran, riwayat progress, ubah status/kondisi, dan aksi kelompok.
 */
export function GroupDetailDialog({
  group, idealGroupSize = 7, busy = '', onClose,
  onSetProgress, onSetCondition, onFinalize, onAssign, onComplete, onDisband,
}: Props) {
  const [progress, setProgress] = useState('');
  const [condition, setCondition] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProgress('');
    setCondition('');
    setNote('');
  }, [group?.id]);

  if (!group) return null;

  const a = group.guideAssignment ?? null;
  const confirmed = group.status === 'LENGKAP' || group.status === 'SIAP_BERANGKAT';
  const isDone = group.progressStatus === 'DONE';
  const sisa = Math.max(0, idealGroupSize - group.totalParticipants);
  const targets = validProgressTargets(group.progressStatus);
  const canChangeCondition = group.conditionStatus !== 'OVERDUE';

  const totalTagihan = group.members.reduce((s, m) => s + (m.reservation.payment?.totalAmount ?? m.reservation.participantCount * 25000), 0);
  const totalBayar = group.members.reduce((s, m) => s + (m.reservation.payment?.amountPaid ?? 0), 0);
  const totalSisa = group.members.reduce((s, m) => s + (m.reservation.payment?.remainingAmount ?? 0), 0);

  const submitProgress = async () => {
    if (!progress) return;
    setSaving(true);
    try {
      const ok = await onSetProgress(group, progress as GroupProgressStatus, note);
      if (ok) { setProgress(''); setNote(''); }
    } finally {
      setSaving(false);
    }
  };

  const submitCondition = async () => {
    if (!condition) return;
    setSaving(true);
    try {
      const ok = await onSetCondition(group, condition as GroupConditionStatus, note);
      if (ok) { setCondition(''); setNote(''); }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!group} onOpenChange={(open) => { if (!open && !saving && !busy) onClose(); }}>
      <DialogContent className="flex max-h-[calc(100dvh-2.5rem)] max-w-3xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="flex flex-wrap items-center gap-2.5">
            <UsersRound className="h-5 w-5 shrink-0 text-primary" />
            <span className="font-mono">{group.groupCode}</span>
            <StatusBadge kind="progress" status={group.progressStatus} />
            <StatusBadge kind="condition" status={group.conditionStatus} />
            <StatusBadge status={group.status} className="text-[10px]" />
          </DialogTitle>
          <DialogDescription>
            {formatDateID(group.schedule.date)} · {group.schedule.time} WIB · {group.totalParticipants} peserta
            {' '}· Customer utama: <b>{group.mainCustomer ?? '—'}</b>
            {group.mainReservationCode && <> ({group.mainReservationCode})</>}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 min-h-0 flex-1 space-y-6 overflow-y-auto px-1 py-0.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:transparent">
          {/* ===== A. Informasi Reservasi ===== */}
          <section>
            <h3 className="mb-2.5 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
              <BadgeCheck className="h-4 w-4" /> A. Informasi Reservasi ({group.members.length})
            </h3>
            <div className="overflow-x-auto rounded-xl border [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:transparent">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">Kode</th>
                    <th className="px-3 py-2 font-semibold">Nama</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">WhatsApp</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">Peserta</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">Pembayaran</th>
                  </tr>
                </thead>
                <tbody>
                  {group.members.map((m) => (
                    <tr key={m.id} className="border-b border-dashed last:border-0">
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-bold">{m.reservation.reservationCode}</td>
                      <td className="px-3 py-2.5 font-semibold">{m.reservation.name}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{formatPhone(m.reservation.phone)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{m.participantCount} org</td>
                      <td className="px-3 py-2.5">
                        {m.reservation.payment ? (
                          <div className="flex flex-col items-start gap-1">
                            <PaymentMethodBadge method={m.reservation.payment.paymentMethod} />
                            <PaymentStatusBadge status={m.reservation.payment.paymentStatus} method={m.reservation.payment.paymentMethod} />
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ===== B. Informasi Keberangkatan ===== */}
          <section>
            <h3 className="mb-2.5 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="h-4 w-4" /> B. Informasi Keberangkatan
            </h3>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <InfoTile icon={CalendarDays} label="Tanggal" value={formatDateID(group.schedule.date, false)} />
              <InfoTile icon={Clock} label="Jam" value={`${group.schedule.time} WIB`} />
              <InfoTile icon={Users} label="Peserta Saat Ini" value={`${group.totalParticipants} orang`} />
              <InfoTile icon={UsersRound} label="Sisa Kapasitas" value={`${sisa} dari ${idealGroupSize} slot`} />
            </div>
          </section>

          {/* ===== C. Informasi Pengelompokan ===== */}
          <section>
            <h3 className="mb-2.5 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
              <Users className="h-4 w-4" /> C. Informasi Pengelompokan
            </h3>
            <div className="space-y-3 rounded-xl border p-3.5">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <InfoTile icon={UsersRound} label="Kode Grup" value={group.groupCode} />
                <InfoTile icon={Users} label="Jumlah Anggota" value={`${group.members.length} reservasi`} />
                <InfoTile icon={Repeat} label="Status Progress" value={PROGRESS_STATUS_LABEL[group.progressStatus]} />
                <InfoTile icon={Tag} label="Status Kondisi" value={CONDITION_STATUS_LABEL[group.conditionStatus]} />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Daftar Peserta</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.members.map((m) => (
                    <span key={m.id} className="rounded-lg border bg-muted/50 px-2.5 py-1 text-xs font-semibold">
                      {m.reservation.name} <span className="text-muted-foreground">({m.participantCount})</span>
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {PROGRESS_STATUS_DESC[group.progressStatus]} {CONDITION_STATUS_DESC[group.conditionStatus]}
              </p>
            </div>
          </section>

          {/* ===== D. Informasi Pemandu ===== */}
          <section>
            <h3 className="mb-2.5 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
              <LifeBuoy className="h-4 w-4" /> D. Informasi Pemandu
            </h3>
            {a ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50/60 p-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-base font-extrabold text-sky-700">
                  {a.guideName.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-sky-900">
                    {a.guideName}
                    <span className="font-mono text-[11px] font-medium text-sky-600">{a.guideCode}</span>
                    {a.guideStatus && <StatusBadge status={a.guideStatus} />}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-sky-700">
                    <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {formatPhone(a.guidePhone)}</span>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1"><Wallet className="h-3 w-3" /> Honor {formatRupiah(a.rate)}</span>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Ditugaskan {formatDateTimeID(a.assignedAt)}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <StatusBadge status={a.assignmentStatus} />
                  <StatusBadge status={a.paymentStatus} />
                </div>
              </div>
            ) : confirmed ? (
              <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm font-medium text-amber-800">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Kelompok ini sudah dikonfirmasi tetapi belum memiliki pemandu. Tugaskan pemandu agar kelompok siap berangkat.
              </p>
            ) : (
              <p className="rounded-xl border bg-muted/40 p-3.5 text-sm text-muted-foreground">
                Belum ada pemandu — kelompok masih dalam proses pengelompokan.
              </p>
            )}
          </section>

          {/* ===== E. Pembayaran ===== */}
          <section>
            <h3 className="mb-2.5 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
              <Wallet className="h-4 w-4" /> E. Pembayaran
            </h3>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <InfoTile icon={Wallet} label="Total Tagihan" value={formatRupiah(totalTagihan)} />
              <InfoTile icon={CheckCircle2} label="Terbayar" value={formatRupiah(totalBayar)} />
              <InfoTile icon={Clock} label="Sisa" value={formatRupiah(totalSisa)} />
              <InfoTile icon={BadgeCheck} label="Status" value={group.paymentSummary?.label ?? '—'} />
            </div>
          </section>

          {/* ===== Riwayat Progress ===== */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
              <History className="h-4 w-4" /> Riwayat Progress
            </h3>
            <HistoryTimeline group={group} />
          </section>

          {/* ===== Ubah Status Progress ===== */}
          <section>
            <h3 className="mb-2.5 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
              <Repeat className="h-4 w-4" /> Ubah Status Progress
            </h3>
            <div className="space-y-2.5 rounded-xl border p-3.5">
              <Select value={progress || undefined} onValueChange={setProgress}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih status progress baru…" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className="font-semibold">{PROGRESS_STATUS_LABEL[s]}</span>
                      <span className="ml-2 text-xs text-muted-foreground">— {PROGRESS_STATUS_DESC[s]}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                Alur sah: Terbaru → Sedang Diproses → Selesai. Pengelompokan baru tidak dapat langsung diselesaikan
                tanpa melalui proses terlebih dahulu.
              </p>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Catatan perubahan (opsional) — mis. alasan, kelengkapan, keputusan…"
                className="min-h-[64px] text-sm"
              />
              <Button
                onClick={submitProgress}
                disabled={!progress || saving || busy === group.id + 'status'}
                className="w-full font-bold"
              >
                {saving || busy === group.id + 'status' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Repeat className="mr-2 h-4 w-4" />}
                Simpan Perubahan Progress
              </Button>
            </div>
          </section>

          {/* ===== Ubah Status Kondisi ===== */}
          <section>
            <h3 className="mb-2.5 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
              <Tag className="h-4 w-4" /> Ubah Status Kondisi
            </h3>
            <div className="space-y-2.5 rounded-xl border p-3.5">
              {group.conditionStatus === 'OVERDUE' ? (
                <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Kondisi Overdue ditentukan otomatis oleh sistem (waktu keberangkatan mendekati/melewati batas).
                  Selesaikan pengelompokan agar kondisi kembali normal.
                </p>
              ) : (
                <>
                  <Select value={condition || undefined} onValueChange={setCondition}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih kondisi baru…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(['NORMAL', 'PENDING'] as const)
                        .filter((c) => c !== group.conditionStatus)
                        .map((c) => (
                          <SelectItem key={c} value={c}>
                            <span className="font-semibold">{CONDITION_STATUS_LABEL[c]}</span>
                            <span className="ml-2 text-xs text-muted-foreground">— {CONDITION_STATUS_DESC[c]}</span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={submitCondition}
                    disabled={!condition || saving || busy === group.id + 'condition' || !canChangeCondition}
                    variant="outline"
                    className="w-full font-bold"
                  >
                    {saving || busy === group.id + 'condition' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Tag className="mr-2 h-4 w-4" />}
                    Simpan Perubahan Kondisi
                  </Button>
                </>
              )}
            </div>
          </section>
        </div>

        {/* ===== Aksi ===== */}
        <div className="shrink-0 border-t pt-3.5">
          <div className="flex flex-wrap gap-2">
            {group.progressStatus === 'NEW' && (
              <Button
                size="sm" className="flex-1 bg-sky-600 font-bold hover:bg-sky-700"
                disabled={busy === group.id + 'status'}
                onClick={() => onSetProgress(group, 'IN_PROGRESS', 'Admin mulai memproses pengelompokan.')}
              >
                {busy === group.id + 'status' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Repeat className="mr-1.5 h-4 w-4" />}
                Proses Pengelompokan
              </Button>
            )}
            {group.status === 'MENUNGGU' && (
              <Button
                size="sm" className="flex-1 bg-emerald-600 font-bold hover:bg-emerald-700"
                disabled={busy === group.id + 'finalize'}
                onClick={() => onFinalize(group)}
              >
                {busy === group.id + 'finalize' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                Konfirmasi Kelompok
              </Button>
            )}
            {confirmed && !a && (
              <Button size="sm" className="flex-1 bg-sky-600 font-bold hover:bg-sky-700" onClick={() => onAssign(group, 'assign')}>
                <UserRound className="mr-1.5 h-4 w-4" /> Tugaskan Guide
              </Button>
            )}
            {a && a.assignmentStatus === 'DITUGASKAN' && (
              <>
                <Button size="sm" variant="outline" className="flex-1 border-sky-200 font-bold text-sky-700 hover:bg-sky-50" onClick={() => onAssign(group, 'change')}>
                  <Repeat className="mr-1.5 h-4 w-4" /> Ganti Guide
                </Button>
                <Button
                  size="sm" variant="outline" className="flex-1 border-emerald-200 font-bold text-emerald-700 hover:bg-emerald-50"
                  disabled={busy === group.id + 'complete'}
                  onClick={() => onComplete(group)}
                >
                  {busy === group.id + 'complete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="mr-1.5 h-4 w-4" />}
                  Tandai Selesai
                </Button>
              </>
            )}
            {isDone && (
              <Button
                size="sm" variant="outline" className="flex-1 border-amber-200 font-bold text-amber-700 hover:bg-amber-50"
                disabled={busy === group.id + 'status'}
                onClick={() => onSetProgress(group, 'IN_PROGRESS', 'Pengelompokan dibuka kembali.')}
              >
                <Repeat className="mr-1.5 h-4 w-4" /> Buka Kembali
              </Button>
            )}
            <Button
              size="sm" variant="outline" className="border-rose-200 font-semibold text-rose-600 hover:bg-rose-50"
              disabled={busy === group.id + 'disband'}
              onClick={() => onDisband(group)}
            >
              {busy === group.id + 'disband' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              <span className="ml-1.5">Bubarkan</span>
            </Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Terakhir diperbarui {formatRelative(group.lastActivity ?? group.createdAt)}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1.5 text-sm font-extrabold leading-snug">{value}</p>
    </div>
  );
}
