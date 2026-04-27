'use client';

import { useParams } from 'next/navigation';
import { SubRouteShell } from '../_shared/sub-route-shell';
import { ProjectTab } from '@/components/features/engagement/project-tab';

export default function ProjectPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <SubRouteShell active="project">
      <ProjectTab prospectId={id} />
    </SubRouteShell>
  );
}
