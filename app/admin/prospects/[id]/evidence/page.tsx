import { SubRouteShell, ComingSoonBlock } from '../_shared/sub-route-shell';

export default function EvidencePage() {
  return (
    <SubRouteShell active="evidence">
      <ComingSoonBlock
        title="Evidence-dossier."
        description="Hier komt de volledige evidence-weergave: alle 80+ items per bron, met snippets, scores en source-verificatie. Het dossier staat al in de database — de rendering wordt in een volgende phase uitgebouwd."
      />
    </SubRouteShell>
  );
}
