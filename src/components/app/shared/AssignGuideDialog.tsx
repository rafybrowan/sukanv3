'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck, Ban, Loader2, LifeBuoy, Repeat, TriangleAlert, UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge } from '@/components/app/shared/StatusBadge';
import { api } from '@/lib/api-client';
import { formatPhone, formatRupiah, formatDateID } from '@/lib/format';
import type { GroupDTO, GuideDTO } from '@/lib/types';

interface Props {
  /** kelompok tujuan; null = tutup */
  group: GroupDTO | null;
  /** mode: assign (tugaskan baru) | change (ganti guide) */
  mode: 'assign' | 'change';
  currentGuideId?: string;
  onClose: () => void;
  onDone: (message: string) => void;
}

/**
 * Modal pilih guide untuk kelompok.
 * Menampilkan seluruh guide + status ketersediaan pada jadwal kelompok;
 * guide bentrok / tidak aktif tidak dapat dipilih.
 *
 * Layout: header + footer (tombol) selalu terlihat; daftar guide di tengah
 * dapat di-scroll — modal tidak pernah melampaui tinggi layar.
 */
export function AssignGuideDialog({ group, mode, currentGuideId, onClose, onDone }: Props) {
  const { toast } = useToast();
  const [guides, setGuides] = useState<GuideDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);

  const current = mode === 'change' ? group?.guideAssignment ?? null : null;

  const load = useCallback(() => {
    if (!group) return;
    setLoading(true);
    setSelected('');
    const exclude = current ? `&excludeAssignmentId=${current.id}` : '';
    api(`/api/admin/guides?scheduleId=${group.scheduleId ?? ''}${exclude}`)
      .then((d) => setGuides(d.guides))
      .catch(() => toast({ title: 'Gagal memuat daftar guide', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [group, current, toast]);

  useEffect(() => { load(); }, [load]);

  if (!group) return null;

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      if (mode === 'assign') {
        const d = await api<{ message: string }>('/api/admin/assignments', {
          method: 'POST',
          body: JSON.stringify({ groupId: group.id, guideId: selected }),
        });
        onDone(d.message || 'Guide berhasil ditugaskan.');
      } else {
        const a = group.guideAssignment;
        if (!a) throw new Error('Penugasan tidak ditemukan.');
        const d = await api<{ message: string }>(`/api/admin/assignments/${a.id}`, {
          method: 'POST',
          body: JSON.stringify({ action: 'change', guideId: selected }),
        });
        onDone(d.message || 'Guide berhasil diganti.');
      }
    } catch (e: any) {
      toast({ title: 'Gagal menugaskan guide', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const availableCount = guides.filter((g) => g.availableForSchedule && g.id !== currentGuideId).length;
  const selectedGuide = guides.find((g) => g.id === selected);

  return (
    <Dialog open={!!group} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="flex max-h-[calc(100vh-2.5rem)] max-w-lg flex-col overflow-hidden supports-[height:100dvh]:max-h-[calc(100dvh-2.5rem)]">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate">{mode === 'assign' ? 'Tugaskan Guide' : 'Ganti Guide'} — {group.groupCode}</span>
          </DialogTitle>
          <DialogDescription>
            {formatDateID(group.schedule.date)} · {group.schedule.time} WIB · {group.totalParticipants} peserta.
            {' '}{mode === 'assign' ? 'Pilih pemandu yang tersedia, lalu konfirmasi penugasan.' : 'Pilih pemandu pengganti, lalu konfirmasi perubahan.'}
          </DialogDescription>
        </DialogHeader>

        {/* Ringkasan guide saat ini (mode ganti) */}
        {current && (
          <div className="flex shrink-0 items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50/60 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-extrabold text-sky-700">
              {current.guideName.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-sky-600">Guide saat ini</p>
              <p className="truncate text-sm font-extrabold text-sky-900">
                {current.guideName} <span className="font-mono text-[11px] font-medium text-sky-600">{current.guideCode}</span>
              </p>
            </div>
            <Repeat className="h-4 w-4 shrink-0 text-sky-400" />
          </div>
        )}

        {/* Daftar guide — dapat di-scroll, header & tombol tetap terlihat */}
        <div className="flex min-h-0 shrink-0 items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
          <span>{mode === 'assign' ? 'Daftar pemandu' : 'Pilih pemandu pengganti'}</span>
          {!loading && guides.length > 0 && (
            <span className="rounded-full bg-muted px-2.5 py-0.5">
              {availableCount} dari {guides.length} tersedia
            </span>
          )}
        </div>
        <div className="-mx-1 min-h-0 flex-1 space-y-2.5 overflow-y-auto px-1 py-0.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:transparent">
          {loading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : guides.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="flex items-center gap-2 font-bold"><TriangleAlert className="h-4 w-4" /> Belum ada data guide</p>
              <p className="mt-1">Tambahkan pemandu terlebih dahulu melalui menu Pemandu / Guide.</p>
            </div>
          ) : (
            <>
              <RadioGroup value={selected} onValueChange={setSelected} className="gap-2.5">
                {guides.map((g) => {
                  const isCurrent = g.id === currentGuideId;
                  const disabled = !g.availableForSchedule || isCurrent;
                  const reason = isCurrent
                    ? 'Pemandu saat ini untuk kelompok ini.'
                    : g.unavailableReason;
                  return (
                    <Label
                      key={g.id}
                      htmlFor={`guide-${g.id}`}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-all ${
                        disabled
                          ? 'cursor-not-allowed border-muted bg-muted/40 opacity-70'
                          : selected === g.id
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'hover:border-primary/40 hover:bg-muted/40'
                      }`}
                    >
                      <RadioGroupItem id={`guide-${g.id}`} value={g.id} disabled={disabled} />
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-extrabold text-primary">
                        {g.name.charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                          {g.name}
                          <span className="font-mono text-[11px] font-medium text-muted-foreground">{g.guideCode}</span>
                          <StatusBadge status={g.status} />
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700">
                              <BadgeCheck className="h-3 w-3" /> Saat ini
                            </span>
                          )}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <span>{formatPhone(g.phone)}</span>
                          <span aria-hidden>·</span>
                          <span>Honor {formatRupiah(g.rate)}</span>
                        </p>
                        {reason && (
                          <p className={`mt-1 flex items-start gap-1.5 text-xs font-medium ${
                            isCurrent ? 'text-sky-700' : 'text-rose-600'
                          }`}>
                            {!isCurrent && <Ban className="mt-0.5 h-3 w-3 shrink-0" />}
                            {reason}
                          </p>
                        )}
                      </div>
                    </Label>
                  );
                })}
              </RadioGroup>

              {availableCount === 0 && (
                <p className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-medium text-rose-700">
                  <Ban className="mt-0.5 h-4 w-4 shrink-0" />
                  Tidak ada guide yang tersedia pada jadwal ini. Ubah jadwal kelompok atau tambahkan pemandu baru.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer tombol — selalu terlihat */}
        {guides.length > 0 && (
          <div className="shrink-0 space-y-2.5">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={onClose} disabled={busy}>Batal</Button>
              <Button onClick={submit} disabled={!selected || busy} className="font-bold">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserRound className="mr-2 h-4 w-4" />}
                {mode === 'assign' ? 'Tugaskan Guide' : 'Konfirmasi Ganti Guide'}
              </Button>
            </div>
            {selectedGuide && (
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                {mode === 'assign'
                  ? `${selectedGuide.name} akan mendampingi ${group.totalParticipants} peserta ${group.groupCode} dengan honor ${formatRupiah(selectedGuide.rate)}.`
                  : `${selectedGuide.name} akan menggantikan ${current?.guideName ?? 'guide saat ini'} mendampingi ${group.totalParticipants} peserta ${group.groupCode}. Honor mengikuti tarif baru: ${formatRupiah(selectedGuide.rate)}.`}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
