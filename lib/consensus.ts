import { promises as fs } from 'fs';
import path from 'path';
import type { ConsensusFile } from './types';

/** Load data/consensus.json. Returns null if the file is missing or marks
 *  itself as not-yet-run, so the page can render a fallback state. */
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
