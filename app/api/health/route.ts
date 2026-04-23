import { NextResponse } from 'next/server';
import { loadField } from '@/lib/field';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const field = await loadField();
    return NextResponse.json({
      status: 'ok',
      field_size: field.horses.length,
      field_updated: field.meta.updated ?? null,
      field_source: field.meta.note ? 'example' : 'live',
      race_date: field.meta.date,
      deployed_at: process.env.VERCEL_DEPLOYMENT_CREATED_AT ?? null,
      git_commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { status: 'error', message: (e as Error).message },
      { status: 500 },
    );
  }
}
