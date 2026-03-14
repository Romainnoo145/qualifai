'use client';

import { DashboardClient } from './prospect-dashboard-client';

type DashboardProps = React.ComponentProps<typeof DashboardClient>;

export function AtlantisProspectDashboardClient(props: DashboardProps) {
  return <DashboardClient {...props} projectType="ATLANTIS" />;
}
