export type StageClass = 'future' | 'pre_construction' | 'construction' | 'archived';
export type OrganisingUniverse = 'active' | 'potential' | 'excluded';

export function mapBciStageToStageClass(stage?: string | null, status?: string | null): StageClass {
  const s = (stage || '').toLowerCase();
  const st = (status || '').toLowerCase();

  if (/(cancel|complete|abandon|defer|hold)/.test(st) || /(cancel|complete|abandon|defer|hold)/.test(s)) return 'archived';
  if (/construction/.test(s)) return 'construction';
  if (/future/.test(s)) return 'future';
  if (/(design|tender|award|planning|document)/.test(s)) return 'pre_construction';
  return 'pre_construction';
}

export function defaultOrganisingUniverseFor(stageClass: StageClass, value?: number | null): OrganisingUniverse {
  // Extra rule: Active if value > $20M and stage is construction
  if (value != null && Number.isFinite(value) && value > 20000000 && stageClass === 'construction') return 'active';
  if (stageClass === 'construction') return 'active';
  if (stageClass === 'archived') return 'excluded';
  return 'potential';
}


