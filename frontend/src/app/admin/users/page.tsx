'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Skeleton } from '@/components/ui';
import { Search, Ban, CheckCircle, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

interface AdminUser {
  id: string;
  name: string;
  displayName?: string;
  email?: string;
  role: string;
  status: string;
  karma: number;
  createdAt: string;
  lastActive?: string;
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

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const limit = 20;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ limit: String(limit), offset: String(page * limit), ...(search && { q: search }) });
      const res = await fetchWithAuth<{ data: AdminUser[]; pagination: { hasMore: boolean } }>(`/admin/users?${query}`);
      setUsers(res.data);
      setHasMore(res.pagination?.hasMore ?? false);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const toggleBan = async (user: AdminUser) => {
    const action = user.status === 'suspended' ? 'unban' : 'ban';
    try {
      await fetchWithAuth(`/admin/users/${user.id}/${action}`, { method: 'POST' });
      loadUsers();
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Users Management</h2>
        <p className="text-muted-foreground">View, search, and manage platform users</p>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
      </div>

      {/* User detail modal */}
      {selectedUser && (
        <Card className="border-primary">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>User Details: {selectedUser.displayName || selectedUser.name}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>Close</Button>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div><span className="font-medium">ID:</span> {selectedUser.id}</div>
            <div><span className="font-medium">Username:</span> {selectedUser.name}</div>
            <div><span className="font-medium">Email:</span> {selectedUser.email || '—'}</div>
            <div><span className="font-medium">Role:</span> {selectedUser.role}</div>
            <div><span className="font-medium">Status:</span> {selectedUser.status}</div>
            <div><span className="font-medium">Karma:</span> {selectedUser.karma}</div>
            <div><span className="font-medium">Joined:</span> {new Date(selectedUser.createdAt).toLocaleDateString()}</div>
            <div><span className="font-medium">Last Active:</span> {selectedUser.lastActive ? new Date(selectedUser.lastActive).toLocaleDateString() : '—'}</div>
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
                  <th className="px-4 py-3 text-left font-medium">User</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Karma</th>
                  <th className="px-4 py-3 text-left font-medium">Joined</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      ))}
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No users found</td></tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{user.displayName || user.name}</div>
                        <div className="text-xs text-muted-foreground">@{user.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>{user.status}</Badge>
                      </td>
                      <td className="px-4 py-3">{user.karma}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setSelectedUser(user)} title="View details">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleBan(user)}
                            title={user.status === 'suspended' ? 'Unban' : 'Ban'}
                          >
                            {user.status === 'suspended' ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Ban className="h-4 w-4 text-red-600" />}
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

      {/* Pagination */}
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
