import { SubRouteShell, ComingSoonBlock } from '../_shared/sub-route-shell';

export default function ResultatenPage() {
  return (
    <SubRouteShell active="resultaten">
      <ComingSoonBlock
        title="Resultaten & conversie."
        description="Open rates, reply rates, meeting-conversie, en gekoppelde offertes/invoices per prospect. De vierkante-meter-weergave van ROI per company. Wordt gevuld zodra de eerste cadences live draaien."
      />
    </SubRouteShell>
  );
}
