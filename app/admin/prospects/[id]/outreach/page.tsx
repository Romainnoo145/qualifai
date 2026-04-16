import { SubRouteShell, ComingSoonBlock } from '../_shared/sub-route-shell';

export default function OutreachPage() {
  return (
    <SubRouteShell active="outreach">
      <ComingSoonBlock
        title="Outreach-cadence."
        description="De unified draft queue per prospect: opeenvolgende touches, reply-detectie, en scheduled sends. Koppelt aan de centrale Draft Queue maar filtert op deze company. Cadence-editor volgt in Fase B."
      />
    </SubRouteShell>
  );
}
