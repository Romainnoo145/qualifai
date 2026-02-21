import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import prisma from '@/lib/prisma';
import { renderPlainTextPdf } from '@/lib/pdf-render';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const lossMap = await prisma.workflowLossMap.findUnique({
    where: { id },
    include: {
      prospect: { select: { companyName: true, domain: true } },
    },
  });

  if (!lossMap) {
    return NextResponse.json({ error: 'Loss map not found' }, { status: 404 });
  }

  const filenameBase = (lossMap.prospect.companyName ?? lossMap.prospect.domain)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const basename = `${filenameBase || 'workflow-loss-map'}-v${lossMap.version}`;
  const format = req.nextUrl.searchParams.get('format') ?? 'html';

  if (format === 'pdf') {
    const pdfFilename = `${basename}.pdf`;

    if (
      lossMap.pdfUrl?.startsWith('http://') ||
      lossMap.pdfUrl?.startsWith('https://')
    ) {
      return NextResponse.redirect(lossMap.pdfUrl, 302);
    }

    if (lossMap.pdfUrl?.startsWith('file://')) {
      try {
        const localPath = lossMap.pdfUrl.replace('file://', '');
        const fileBuffer = await readFile(localPath);
        return new NextResponse(new Uint8Array(fileBuffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${pdfFilename}"`,
          },
        });
      } catch (error) {
        console.error(
          'loss-map pdf read failed; falling back to inline render',
          error,
        );
      }
    }

    const inlinePdf = renderPlainTextPdf(lossMap.markdown);
    return new NextResponse(new Uint8Array(inlinePdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfFilename}"`,
      },
    });
  }

  const filename = `${basename}.html`;

  const html = lossMap.html ?? `<pre>${lossMap.markdown}</pre>`;
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
