import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/env.mjs';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-admin-token');
  if (token !== env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prospects = await prisma.prospect.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      companyName: true,
      domain: true,
      industry: true,
      subIndustry: true,
      employeeRange: true,
      employeeCount: true,
      revenueRange: true,
      country: true,
      city: true,
      state: true,
      linkedinUrl: true,
      foundedYear: true,
      technologies: true,
      status: true,
      createdAt: true,
      _count: { select: { contacts: true, sessions: true } },
    },
  });

  const headers = [
    'Company Name',
    'Domain',
    'Industry',
    'Sub-Industry',
    'Employees',
    'Employee Count',
    'Revenue',
    'Country',
    'City',
    'State',
    'LinkedIn',
    'Founded',
    'Technologies',
    'Status',
    'Contacts',
    'Sessions',
    'Created',
  ];

  const rows = prospects.map((p) => [
    p.companyName ?? '',
    p.domain,
    p.industry ?? '',
    p.subIndustry ?? '',
    p.employeeRange ?? '',
    p.employeeCount?.toString() ?? '',
    p.revenueRange ?? '',
    p.country ?? '',
    p.city ?? '',
    p.state ?? '',
    p.linkedinUrl ?? '',
    p.foundedYear?.toString() ?? '',
    p.technologies.join('; '),
    p.status,
    p._count.contacts.toString(),
    p._count.sessions.toString(),
    p.createdAt.toISOString(),
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
      'Content-Disposition': `attachment; filename="companies-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
