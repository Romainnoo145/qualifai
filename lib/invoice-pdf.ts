import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';
import { renderToString } from 'react-dom/server';
import type {
  Engagement,
  Invoice,
  Prospect,
  Quote,
  QuoteLine,
} from '@prisma/client';
import { InvoiceRenderer } from '@/components/clients/klarifai/invoice-renderer';

/**
 * Renders an Invoice + its Engagement context to a PDF buffer.
 * Uses puppeteer-core + sparticuz chromium binary for serverless compatibility.
 *
 * Cold-start cost on Vercel: ~2-3s for chromium launch. Acceptable for
 * once-per-invoice-send operations.
 *
 * Vercel/serverless: set CHROMIUM_REMOTE_URL to the sparticuz chromium-min
 * release download URL for the installed version. chromium-min fetches it at
 * runtime. See: https://github.com/Sparticuz/chromium/releases
 *
 * Local dev: set CHROMIUM_EXECUTABLE_PATH to the system chrome binary
 * (e.g. /usr/bin/google-chrome). If neither env var is set, chromium-min
 * attempts to find its own binary (will fail without CHROMIUM_REMOTE_URL).
 */
export async function renderInvoicePdf(args: {
  invoice: Invoice;
  engagement: Engagement & {
    quote: Quote & { lines: QuoteLine[] };
    prospect: Prospect;
  };
}): Promise<Buffer> {
  const html =
    '<!doctype html>' +
    renderToString(
      InvoiceRenderer({
        invoice: args.invoice,
        engagement: args.engagement,
      }),
    );

  // Local dev: prefer a system chrome to avoid remote download
  const localChrome = process.env.CHROMIUM_EXECUTABLE_PATH;
  const executablePath = localChrome
    ? localChrome
    : await chromium.executablePath(process.env.CHROMIUM_REMOTE_URL);

  const launchArgs = localChrome
    ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    : chromium.args;

  const browser = await puppeteer.launch({
    args: launchArgs,
    defaultViewport: { width: 1280, height: 900 },
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30_000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '20mm',
        right: '20mm',
      },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
