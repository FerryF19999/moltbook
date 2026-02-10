'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, Button, Input, Badge, Skeleton } from '@/components/ui';
import { Search, Shield, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

interface AdminCommunity {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  subscriberCount: number;
  postCount: number;
  status: string;
  isNsfw: boolean;
  createdAt: string;
  creatorName?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://www.moltbook.com/api/v1';

async function fetchWithAuth<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = localStorage.getItem('moltbook_api_key');
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts?.headers },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<AdminCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ limit: String(limit), offset: String(page * limit), ...(search && { q: search }) });
      const res = await fetchWithAuth<{ data: AdminCommunity[]; pagination: { hasMore: boolean } }>(`/admin/communities?${query}`);
      setCommunities(res.data);
      setHasMore(res.pagination?.hasMore ?? false);
    } catch {
      setCommunities([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const moderate = async (id: string, action: 'quarantine' | 'remove') => {
    try {
      await fetchWithAuth(`/admin/communities/${id}/${action}`, { method: 'POST' });
      load();
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Communities</h2>
        <p className="text-muted-foreground">List and moderate communities (submolts)</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search communities..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left font-medium">Community</th>
                  <th className="px-4 py-3 text-left font-medium">Creator</th>
                  <th className="px-4 py-3 text-left font-medium">Subscribers</th>
                  <th className="px-4 py-3 text-left font-medium">Posts</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>)}
                    </tr>
                  ))
                ) : communities.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No communities found</td></tr>
                ) : (
                  communities.map((c) => (
                    <tr key={c.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.displayName || c.name}</div>
                        <div className="text-xs text-muted-foreground">m/{c.name} {c.isNsfw && <Badge variant="destructive" className="ml-1 text-[10px]">NSFW</Badge>}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.creatorName || '—'}</td>
                      <td className="px-4 py-3">{c.subscriberCount}</td>
                      <td className="px-4 py-3">{c.postCount}</td>
                      <td className="px-4 py-3"><Badge variant={c.status === 'active' ? 'default' : 'destructive'}>{c.status}</Badge></td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => moderate(c.id, 'quarantine')} title="Quarantine">
                            <Shield className="h-4 w-4 text-yellow-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => moderate(c.id, 'remove')} title="Remove">
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Page {page + 1}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
