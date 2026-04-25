export type PaymentInstallment = {
  label: string;
  percentage: number;
  dueOn: string;
};

export const DEFAULT_PAYMENT_SCHEDULE: PaymentInstallment[] = [
  {
    label: 'Bij akkoord (pre-build)',
    percentage: 30,
    dueOn: 'binnen 14 dagen na akkoord',
  },
  {
    label: 'Bij oplevering sprint 1',
    percentage: 40,
    dueOn: 'binnen 14 dagen na oplevering',
  },
  {
    label: 'Bij eindoplevering',
    percentage: 30,
    dueOn: 'binnen 14 dagen na akkoord eindoplevering',
  },
];
