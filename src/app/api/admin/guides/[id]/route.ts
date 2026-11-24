import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAdminId, unauthorized } from '@/lib/auth';
import { toAssignmentDTO } from '@/lib/guide-helpers';

export const dynamic = 'force-dynamic';

/** GET /api/admin/guides/[id] — detail guide + riwayat penugasan */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!getAdminId(req)) return unauthorized();
  const { id } = await params;

  const guide = await db.guide.findUnique({
    where: { id },
    include: {
      assignments: { include: { group: true, schedule: true }, orderBy: { assignmentDate: 'desc' } },
    },
  });
  if (!guide) return Response.json({ error: 'Guide tidak ditemukan.' }, { status: 404 });

  const active = guide.assignments.filter((a) => a.assignmentStatus === 'DITUGASKAN');
  return Response.json({
    guide: {
      id: guide.id,
      guideCode: guide.guideCode,
      name: guide.name,
      phone: guide.phone,
      rate: guide.rate,
      status: guide.status,
      notes: guide.notes,
      createdAt: guide.createdAt,
      totalAssignments: guide.assignments.filter((a) => a.assignmentStatus !== 'DIBATALKAN').length,
      completedAssignments: guide.assignments.filter((a) => a.assignmentStatus === 'SELESAI').length,
      totalHonor: guide.assignments
        .filter((a) => a.assignmentStatus === 'SELESAI')
        .reduce((s, a) => s + a.rate, 0),
      honorPaid: guide.assignments
        .filter((a) => a.paymentStatus === 'SUDAH_DIBAYARKAN')
        .reduce((s, a) => s + a.rate, 0),
      honorUnpaid: guide.assignments
        .filter((a) => a.assignmentStatus === 'SELESAI' && a.paymentStatus !== 'SUDAH_DIBAYARKAN')
        .reduce((s, a) => s + a.rate, 0),
      currentAssignment: active[0] ? toAssignmentDTO(active[0]) : null,
    },
    assignments: guide.assignments.map(toAssignmentDTO),
  });
}

/**
 * PATCH /api/admin/guides/[id] — ubah data guide / toggle aktif.
 * Body: { name?, phone?, rate?, status?, notes?, toggleActive?: true }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!getAdminId(req)) return unauthorized();
  const { id } = await params;
  const body = await req.json();

  const guide = await db.guide.findUnique({
    where: { id },
    include: { assignments: { where: { assignmentStatus: 'DITUGASKAN' } } },
  });
  if (!guide) return Response.json({ error: 'Guide tidak ditemukan.' }, { status: 404 });

  // toggle aktif/nonaktif
  if (body.toggleActive) {
    if (guide.status === 'TIDAK_AKTIF') {
      await db.guide.update({
        where: { id },
        data: { status: guide.assignments.length > 0 ? 'DITUGASKAN' : 'TERSEDIA' },
      });
      return Response.json({ ok: true, status: guide.assignments.length > 0 ? 'DITUGASKAN' : 'TERSEDIA' });
    }
    // nonaktifkan — tolak bila sedang ada penugasan aktif
    if (guide.assignments.length > 0) {
      return Response.json(
        { error: `Tidak dapat menonaktifkan: ${guide.name} masih memiliki ${guide.assignments.length} penugasan aktif. Selesaikan atau batalkan penugasan terlebih dahulu.` },
        { status: 409 }
      );
    }
    await db.guide.update({ where: { id }, data: { status: 'TIDAK_AKTIF' } });
    return Response.json({ ok: true, status: 'TIDAK_AKTIF' });
  }

  // edit data umum
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return Response.json({ error: 'Nama wajib diisi.' }, { status: 400 });
    data.name = name;
  }
  if (body.phone !== undefined) {
    const phone = String(body.phone).trim();
    if (!phone) return Response.json({ error: 'Nomor telepon wajib diisi.' }, { status: 400 });
    data.phone = phone;
  }
  if (body.rate !== undefined) {
    const rate = Number(body.rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      return Response.json({ error: 'Tarif/honor harus berupa angka lebih dari 0.' }, { status: 400 });
    }
    data.rate = Math.round(rate);
  }
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;
  if (body.status !== undefined) {
    if (!['TERSEDIA', 'DITUGASKAN', 'TIDAK_AKTIF'].includes(body.status)) {
      return Response.json({ error: 'Status tidak valid.' }, { status: 400 });
    }
    if (body.status !== 'TIDAK_AKTIF' && guide.assignments.length > 0) {
      return Response.json(
        { error: 'Guide masih memiliki penugasan aktif — status otomatis DITUGASKAN.' },
        { status: 409 }
      );
    }
    data.status = body.status;
  }

  const updated = await db.guide.update({ where: { id }, data });
  return Response.json({ guide: updated });
}
