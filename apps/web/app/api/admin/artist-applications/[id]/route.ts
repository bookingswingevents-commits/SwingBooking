import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'DEPRECATED_ARTIST_APPLICATIONS' },
    { status: 410 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { ok: false, error: 'DEPRECATED_ARTIST_APPLICATIONS' },
    { status: 410 }
  );
}
