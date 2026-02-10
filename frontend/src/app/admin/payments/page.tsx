'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, Button, Input, Badge, Skeleton } from '@/components/ui';
import { Search, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

interface Payment {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  description?: string;
  createdAt: string;
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

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ limit: String(limit), offset: String(page * limit), ...(search && { q: search }) });
      const res = await fetchWithAuth<{ data: Payment[]; pagination: { hasMore: boolean } }>(`/admin/payments?${query}`);
      setPayments(res.data);
      setHasMore(res.pagination?.hasMore ?? false);
    } catch {
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const refund = async (id: string) => {
    if (!confirm('Are you sure you want to refund this payment?')) return;
    try {
      await fetchWithAuth(`/admin/payments/${id}/refund`, { method: 'POST' });
      load();
    } catch { /* ignore */ }
  };

  const statusColor = (s: string) => {
    if (s === 'completed' || s === 'succeeded') return 'default' as const;
    if (s === 'pending') return 'secondary' as const;
    if (s === 'refunded') return 'outline' as const;
    return 'destructive' as const;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Payments</h2>
        <p className="text-muted-foreground">View all payments and process refunds</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search payments..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left font-medium">ID</th>
                  <th className="px-4 py-3 text-left font-medium">User</th>
                  <th className="px-4 py-3 text-left font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Method</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
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
                ) : payments.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No payments found</td></tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-4 py-3 font-mono text-xs">{p.id.slice(0, 8)}...</td>
                      <td className="px-4 py-3 font-medium">{p.userName}</td>
                      <td className="px-4 py-3">{p.currency?.toUpperCase() || 'USD'} {p.amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.method || '—'}</td>
                      <td className="px-4 py-3"><Badge variant={statusColor(p.status)}>{p.status}</Badge></td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        {p.status !== 'refunded' && p.status !== 'failed' && (
                          <Button variant="ghost" size="icon" onClick={() => refund(p.id)} title="Refund">
                            <RotateCcw className="h-4 w-4 text-orange-600" />
                          </Button>
                        )}
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
