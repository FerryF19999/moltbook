import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '../middleware';

export async function GET(request: NextRequest) {
  const denied = await verifyAdmin(request);
  if (denied) return denied;

  const token = request.headers.get('authorization')?.slice(7);
  const API_BASE = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://www.moltbook.com/api/v1';
  const { searchParams } = new URL(request.url);

  try {
    const res = await fetch(`${API_BASE}/admin/payments?${searchParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return NextResponse.json(await res.json());
  } catch { /* fallthrough */ }

  return NextResponse.json({ data: [], pagination: { count: 0, limit: 20, offset: 0, hasMore: false } });
}
