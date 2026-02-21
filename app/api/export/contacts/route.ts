import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/env.mjs';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-admin-token');
  if (token !== env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contacts = await prisma.contact.findMany({
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
