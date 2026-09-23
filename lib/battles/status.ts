export interface BattleRenderStatus {
  status: 'loading' | 'ready' | 'error' | 'empty';
  eventId?: string;
  progress: number;
  models: number;
  scale?: number;
  error?: string;
  armycounts?: {
    id: string;
    label: string;
    models: number;
    activeModels?: number;
    withdrawnModels?: number;
    deadModels?: number;
    counts?: 'soldiers' | 'ships' | 'aircraft';
    strength?: number;
    casualties?: number;
    deaths?: number;
    soldiersPerModel?: number;
    symbolic: boolean;
    profileLabel?: string;
    profileEvidence?: 'documented-profile' | 'representative';
    profileSources?: readonly { label: string; url: string }[];
  }[];
}

let latestStatus: BattleRenderStatus | undefined;

export function getBattleRenderStatus(): BattleRenderStatus | undefined {
  return latestStatus;
}

export function publishBattleRenderStatus(detail: BattleRenderStatus): void {
  latestStatus = detail;
  window.dispatchEvent(new CustomEvent('atlas:battle-status', { detail }));
}
