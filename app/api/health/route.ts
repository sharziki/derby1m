import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { loadField } from '@/lib/field';
import { consensusReady } from '@/lib/consensus';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const field = await loadField();
    const dataDir = path.join(process.cwd(), 'data');
    const hasProdFile = await fs
      .access(path.join(dataDir, 'field.json'))
      .then(() => true)
      .catch(() => false);

    return NextResponse.json({
      status: 'ok',
      field_mode: hasProdFile ? 'production' : 'pre_draw_example',
      field_size: field.horses.length,
      field_last_updated: field.meta.updated
        ? `${field.meta.updated}T00:00:00Z`
        : null,
      race_date: field.meta.date,
      consensus_ready: await consensusReady(),
      build_sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      deployed_at: process.env.VERCEL_DEPLOYMENT_CREATED_AT ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { status: 'error', message: (e as Error).message },
      { status: 500 },
    );
  }
}
