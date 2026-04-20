import type { UseCaseSector } from '@prisma/client';

export const SECTOR_LABELS: Record<UseCaseSector, string> = {
  BOUW: 'Bouw & Aannemerij',
  INSTALLATIE: 'Installatie & Techniek',
  ONDERHOUD: 'Onderhoud & Servicebedrijven',
  PRODUCTIE: 'Productie & Maakindustrie',
  LOGISTIEK: 'Logistiek & Transport',
  ZORG: 'Zorginstellingen kleinschalig',
  BOUW_DIENSTEN: 'Bouwgerelateerde diensten',
  ZAKELIJK: 'Zakelijke Dienstverlening',
  ACCOUNTANCY: 'Accountancy- & Administratiekantoren',
  ENERGIE: 'Energie, Installateurs & Duurzaamheidsadvies',
};

export function industryToSector(
  industry: string | null,
): UseCaseSector | null {
  if (!industry) return null;
  const lower = industry.toLowerCase();

  if (
    lower.includes('construction') ||
    lower.includes('bouw') ||
    lower.includes('building')
  )
    return 'BOUW';
  if (
    lower.includes('hvac') ||
    lower.includes('install') ||
    lower.includes('electrical') ||
    lower.includes('plumbing')
  )
    return 'INSTALLATIE';
  if (
    lower.includes('facility') ||
    lower.includes('maintenance') ||
    lower.includes('cleaning') ||
    lower.includes('onderhoud')
  )
    return 'ONDERHOUD';
  if (
    lower.includes('manufacturing') ||
    lower.includes('production') ||
    lower.includes('industrial') ||
    lower.includes('machining') ||
    lower.includes('fabricat')
  )
    return 'PRODUCTIE';
  if (
    lower.includes('logistics') ||
    lower.includes('transport') ||
    lower.includes('freight') ||
    lower.includes('shipping') ||
    lower.includes('warehousing')
  )
    return 'LOGISTIEK';
  if (
    lower.includes('health') ||
    lower.includes('care') ||
    lower.includes('zorg') ||
    lower.includes('medical') ||
    lower.includes('nursing')
  )
    return 'ZORG';
  if (
    lower.includes('architecture') ||
    lower.includes('engineering services') ||
    lower.includes('civil engineering') ||
    lower.includes('structural')
  )
    return 'BOUW_DIENSTEN';
  if (
    lower.includes('consulting') ||
    lower.includes('professional services') ||
    lower.includes('management consulting') ||
    lower.includes('advisory') ||
    lower.includes('marketing') ||
    lower.includes('advertising') ||
    lower.includes('creative') ||
    lower.includes('legal')
  )
    return 'ZAKELIJK';
  if (
    lower.includes('accounting') ||
    lower.includes('accountancy') ||
    lower.includes('bookkeeping') ||
    lower.includes('audit') ||
    lower.includes('tax')
  )
    return 'ACCOUNTANCY';
  if (
    lower.includes('energy') ||
    lower.includes('solar') ||
    lower.includes('renewable') ||
    lower.includes('sustainability') ||
    lower.includes('utilities') ||
    lower.includes('duurzaam')
  )
    return 'ENERGIE';

  return null;
}
