import { SubRouteShell, ComingSoonBlock } from '../_shared/sub-route-shell';

export default function AnalysePage() {
  return (
    <SubRouteShell active="analyse">
      <ComingSoonBlock
        title="Analyse & narratief."
        description="De master-analyzer output (Gemini 2.5 Pro) komt hier tot zijn recht: flowing narrative, gekoppelde RAG-passages, en de Klarifai-matched opportunities. Dit vervangt de huidige 4-stap wizard door een boardroom-grade dossier."
      />
    </SubRouteShell>
  );
}
