import { promises as fs } from 'fs';
import path from 'path';
import type { ConsensusFile } from './types';

const MIN_VERIFIED_FOR_PUBLIC = 3;

/** Load data/consensus.json. Returns null if the file is missing or not
 *  ready. The /consensus page and the site nav use this same check to
 *  auto-show the feature once real data commits. */
export async function loadConsensus(): Promise<ConsensusFile | null> {
  const p = path.join(process.cwd(), 'data', 'consensus.json');
  try {
    const raw = await fs.readFile(p, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.generated_at || parsed.status === 'not_yet_run') return null;
    return parsed as ConsensusFile;
  } catch {
    return null;
  }
}

/** Is the consensus data ready to show in production? */
export async function consensusReady(): Promise<boolean> {
  const c = await loadConsensus();
  if (!c) return false;
  const verified = (c.expert_picks ?? []).filter((e) => e.status === 'verified');
  return verified.length >= MIN_VERIFIED_FOR_PUBLIC;
}
