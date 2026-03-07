import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveAdminProjectScope } from '@/server/admin-auth';

export async function GET(req: NextRequest) {
  const scope = resolveAdminProjectScope(req.headers.get('x-admin-token'));
  if (!scope) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { slug: scope.allowedProjectSlug },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json(
      { error: `Unknown project scope: ${scope.allowedProjectSlug}` },
      { status: 400 },
    );
  }

  const contacts = await prisma.contact.findMany({
    where: {
      prospect: {
        projectId: project.id,
      },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      prospect: {
        select: { companyName: true, domain: true },
      },
    },
  });

  const headers = [
    'First Name',
    'Last Name',
    'Job Title',
    'Seniority',
    'Department',
    'Email',
    'Phone',
    'Company',
    'Domain',
    'Country',
    'City',
    'LinkedIn',
    'Outreach Status',
    'Last Contacted',
    'Created',
  ];

  const rows = contacts.map((c) => [
    c.firstName,
    c.lastName,
    c.jobTitle ?? '',
    c.seniority ?? '',
    c.department ?? '',
    c.primaryEmail ?? '',
    c.primaryPhone ?? '',
    c.prospect.companyName ?? '',
    c.prospect.domain,
    c.country ?? '',
    c.city ?? '',
    c.linkedinUrl ?? '',
    c.outreachStatus,
    c.lastContactedAt?.toISOString() ?? '',
    c.createdAt.toISOString(),
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','),
    ),
  ].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="contacts-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
