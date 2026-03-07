export type AppProjectType = 'KLARIFAI' | 'ATLANTIS' | null | undefined;

export interface ProjectUiProfile {
  showStackClues: boolean;
  ragSectionLabel: string;
  ragSourceLabel: string;
  ragDescription: string;
  discoverEvidencePluralLabel: string;
}

const DEFAULT_PROFILE: ProjectUiProfile = {
  showStackClues: true,
  ragSectionLabel: 'Knowledge Context',
  ragSourceLabel: 'Knowledge Context',
  ragDescription:
    'Interne contextfragmenten die gebruikt zijn als aanvullende input voor analyse en hypotheses.',
  discoverEvidencePluralLabel: 'contextbronnen',
};

const KLARIFAI_PROFILE: ProjectUiProfile = {
  showStackClues: true,
  ragSectionLabel: 'Use Case Context',
  ragSourceLabel: 'Use Case Context',
  ragDescription:
    'Interne use-case fragmenten die gebruikt zijn als aanvullende context voor analyse en hypotheses.',
  discoverEvidencePluralLabel: 'use cases',
};

const ATLANTIS_PROFILE: ProjectUiProfile = {
  showStackClues: false,
  ragSectionLabel: 'RAG Documents',
  ragSourceLabel: 'RAG Document',
  ragDescription:
    'Interne Atlantis RAG-documentfragmenten die gebruikt zijn als aanvullende context voor analyse en hypotheses.',
  discoverEvidencePluralLabel: 'RAG-documenten',
};

export function getProjectUiProfile(
  projectType: AppProjectType,
): ProjectUiProfile {
  if (projectType === 'ATLANTIS') return ATLANTIS_PROFILE;
  if (projectType === 'KLARIFAI') return KLARIFAI_PROFILE;
  return DEFAULT_PROFILE;
}
