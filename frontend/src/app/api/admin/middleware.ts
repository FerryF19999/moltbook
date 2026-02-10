import { NextRequest, NextResponse } from 'next/server';

export async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  
  // Forward to backend API for admin verification
  const API_BASE = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://www.moltbook.com/api/v1';
  
  try {
    const res = await fetch(`${API_BASE}/agents/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (!res.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const data = await res.json();
    const agent = data.agent;
    
    // Check admin role - adjust field name based on your backend
    if (agent?.role !== 'admin' && !agent?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    return null; // null means authorized
  } catch {
    return NextResponse.json({ error: 'Auth service unavailable' }, { status: 503 });
  }
}
