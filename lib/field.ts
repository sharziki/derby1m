import { promises as fs } from 'fs';
import path from 'path';
import type { FieldFile, ResultFile } from './types';
import { validateField } from './schema';

const DATA_DIR = path.join(process.cwd(), 'data');

/** Load + validate the live field. Falls back to example if no real file. */
export async function loadField(): Promise<FieldFile> {
  const real = path.join(DATA_DIR, 'field.json');
  const example = path.join(DATA_DIR, 'field.example.json');
  for (const p of [real, example]) {
    try {
      const raw = await fs.readFile(p, 'utf-8');
      const parsed = JSON.parse(raw);
      try {
        validateField(parsed);
      } catch (validationErr) {
        throw new Error(
          `Invalid field data at ${p}: ${(validationErr as Error).message}`,
        );
      }
      return parsed as FieldFile;
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') throw e;
    }
  }
  throw new Error(`No field data at ${real} or ${example}`);
}

export async function loadResult(): Promise<ResultFile> {
  const raw = await fs.readFile(path.join(DATA_DIR, 'result.json'), 'utf-8');
  return JSON.parse(raw) as ResultFile;
}
