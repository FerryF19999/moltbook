'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Skeleton } from '@/components/ui';
import { Search, Plus, Minus, ChevronLeft, ChevronRight } from 'lucide-react';

interface CreditTransaction {
  id: string;
  userId: string;
  userName: string;
  type: 'purchase' | 'usage' | 'refund' | 'adjustment';
  amount: number;
  balance: number;
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

export default function CreditsPage() {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ open: false, userId: '', amount: '', reason: '' });
  const limit = 20;

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ limit: String(limit), offset: String(page * limit), ...(search && { q: search }) });
      const res = await fetchWithAuth<{ data: CreditTransaction[]; pagination: { hasMore: boolean } }>(`/admin/credits?${query}`);
      setTransactions(res.data);
      setHasMore(res.pagination?.hasMore ?? false);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const submitAdjustment = async () => {
    if (!adjustForm.userId || !adjustForm.amount) return;
    try {
      await fetchWithAuth('/admin/credits/adjust', {
        method: 'POST',
        body: JSON.stringify({ userId: adjustForm.userId, amount: Number(adjustForm.amount), reason: adjustForm.reason }),
      });
      setAdjustForm({ open: false, userId: '', amount: '', reason: '' });
      loadTransactions();
    } catch { /* ignore */ }
  };

  const typeColor = (t: string) => {
    if (t === 'purchase') return 'default' as const;
    if (t === 'refund') return 'secondary' as const;
    if (t === 'usage') return 'outline' as const;
    return 'destructive' as const;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Credits Management</h2>
          <p className="text-muted-foreground">View transactions and manual adjustments</p>
        </div>
        <Button onClick={() => setAdjustForm((f) => ({ ...f, open: !f.open }))}>
          {adjustForm.open ? 'Cancel' : 'Manual Adjustment'}
        </Button>
      </div>

      {/* Adjustment form */}
      {adjustForm.open && (
        <Card className="border-primary">
          <CardHeader><CardTitle>Manual Credit Adjustment</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="User ID" value={adjustForm.userId} onChange={(e) => setAdjustForm((f) => ({ ...f, userId: e.target.value }))} />
            <Input placeholder="Amount (positive to add, negative to deduct)" type="number" value={adjustForm.amount} onChange={(e) => setAdjustForm((f) => ({ ...f, amount: e.target.value }))} />
            <Input placeholder="Reason" value={adjustForm.reason} onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))} />
            <Button onClick={submitAdjustment}>Submit Adjustment</Button>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by user..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left font-medium">User</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Balance</th>
                  <th className="px-4 py-3 text-left font-medium">Description</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>)}
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No transactions found</td></tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-4 py-3 font-medium">{tx.userName}</td>
                      <td className="px-4 py-3"><Badge variant={typeColor(tx.type)}>{tx.type}</Badge></td>
                      <td className="px-4 py-3">
                        <span className={tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {tx.amount >= 0 ? '+' : ''}{tx.amount}
                        </span>
                      </td>
                      <td className="px-4 py-3">{tx.balance}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{tx.description || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</td>
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
