/**
 * PersonaStorage — 활성 LUA 페르소나 localStorage 영속화.
 *
 * 'nou_' prefix 룰 적용 (AutoBackup 자동 백업 대상).
 */

import { DEFAULT_PERSONA_ID, PERSONAS } from '../data/PersonaCatalog';

const KEY = 'nou_active_persona';
const validIds = new Set(PERSONAS.map(p => p.id));

export function getActivePersonaId() {
  try {
    const v = localStorage.getItem(KEY);
    return v && validIds.has(v) ? v : DEFAULT_PERSONA_ID;
  } catch {
    return DEFAULT_PERSONA_ID;
  }
}

export function setActivePersonaId(id) {
  if (!validIds.has(id)) return false;
  try { localStorage.setItem(KEY, id); return true; } catch { return false; }
}
