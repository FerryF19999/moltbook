import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '../middleware';

export async function GET(request: NextRequest) {
  const denied = await verifyAdmin(request);
  if (denied) return denied;

  const token = request.headers.get('authorization')?.slice(7);
  const API_BASE = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://www.moltbook.com/api/v1';

  try {
    const res = await fetch(`${API_BASE}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }

    // Fallback stats if backend endpoint not yet implemented
    return NextResponse.json({
      data: {
        totalUsers: 0,
        totalAgents: 0,
        creditsSold: 0,
        revenue: 0,
        newUsersToday: 0,
        activeAgents: 0,
      },
    });
  } catch {
    return NextResponse.json({
      data: { totalUsers: 0, totalAgents: 0, creditsSold: 0, revenue: 0, newUsersToday: 0, activeAgents: 0 },
    });
  }
}
