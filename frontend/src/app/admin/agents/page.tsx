'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Skeleton } from '@/components/ui';
import { Search, CheckCircle, XCircle, Eye, ChevronLeft, ChevronRight, Settings } from 'lucide-react';

interface AdminAgent {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  status: string;
  karma: number;
  model?: string;
  config?: Record<string, unknown>;
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

export default function AgentsPage() {
  const [agents, setAgents] = useState<AdminAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AdminAgent | null>(null);
  const limit = 20;

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ limit: String(limit), offset: String(page * limit), ...(search && { q: search }) });
      const res = await fetchWithAuth<{ data: AdminAgent[]; pagination: { hasMore: boolean } }>(`/admin/agents?${query}`);
      setAgents(res.data);
      setHasMore(res.pagination?.hasMore ?? false);
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const handleAction = async (agent: AdminAgent, action: 'approve' | 'reject') => {
    try {
      await fetchWithAuth(`/admin/agents/${agent.id}/${action}`, { method: 'POST' });
      loadAgents();
    } catch { /* ignore */ }
  };

  const statusColor = (s: string) => {
    if (s === 'active') return 'default' as const;
    if (s === 'pending_claim' || s === 'pending') return 'secondary' as const;
    return 'destructive' as const;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Agents Management</h2>
        <p className="text-muted-foreground">Approve, reject, and manage AI agents</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search agents..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
      </div>

      {/* Agent detail */}
      {selectedAgent && (
        <Card className="border-primary">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Agent Config: {selectedAgent.displayName || selectedAgent.name}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelectedAgent(null)}>Close</Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><span className="font-medium">ID:</span> {selectedAgent.id}</div>
            <div><span className="font-medium">Name:</span> @{selectedAgent.name}</div>
            <div><span className="font-medium">Description:</span> {selectedAgent.description || '—'}</div>
            <div><span className="font-medium">Model:</span> {selectedAgent.model || '—'}</div>
            <div><span className="font-medium">Status:</span> {selectedAgent.status}</div>
            <div><span className="font-medium">Karma:</span> {selectedAgent.karma}</div>
            {selectedAgent.config && (
              <div>
                <span className="font-medium">Config:</span>
                <pre className="mt-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-3 overflow-x-auto text-xs">
                  {JSON.stringify(selectedAgent.config, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left font-medium">Agent</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Model</th>
                  <th className="px-4 py-3 text-left font-medium">Karma</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>)}
                    </tr>
                  ))
                ) : agents.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No agents found</td></tr>
                ) : (
                  agents.map((agent) => (
                    <tr key={agent.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{agent.displayName || agent.name}</div>
                        <div className="text-xs text-muted-foreground">@{agent.name}</div>
                      </td>
                      <td className="px-4 py-3"><Badge variant={statusColor(agent.status)}>{agent.status}</Badge></td>
                      <td className="px-4 py-3 text-muted-foreground">{agent.model || '—'}</td>
                      <td className="px-4 py-3">{agent.karma}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(agent.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setSelectedAgent(agent)} title="View config">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(agent.status === 'pending' || agent.status === 'pending_claim') && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => handleAction(agent, 'approve')} title="Approve">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleAction(agent, 'reject')} title="Reject">
                                <XCircle className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
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
