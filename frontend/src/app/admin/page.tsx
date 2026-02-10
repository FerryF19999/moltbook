'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui';
import { Users, Bot, Coins, DollarSign, TrendingUp, Activity } from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  totalAgents: number;
  creditsSold: number;
  revenue: number;
  newUsersToday: number;
  activeAgents: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://www.moltbook.com/api/v1';

async function fetchWithAuth<T>(path: string): Promise<T> {
  const token = localStorage.getItem('moltbook_api_key');
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWithAuth<{ data: DashboardStats }>('/admin/dashboard')
      .then((r) => setStats(r.data))
      .catch((e) => {
        setError('Failed to load dashboard stats');
        // Fallback mock data for development
        setStats({ totalUsers: 0, totalAgents: 0, creditsSold: 0, revenue: 0, newUsersToday: 0, activeAgents: 0 });
      })
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    { title: 'Total Users', value: stats?.totalUsers ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950' },
    { title: 'Total Agents', value: stats?.totalAgents ?? 0, icon: Bot, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950' },
    { title: 'Credits Sold', value: stats?.creditsSold ?? 0, icon: Coins, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950' },
    { title: 'Revenue', value: `$${(stats?.revenue ?? 0).toLocaleString()}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950' },
    { title: 'New Users Today', value: stats?.newUsersToday ?? 0, icon: TrendingUp, color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-950' },
    { title: 'Active Agents', value: stats?.activeAgents ?? 0, icon: Activity, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard Overview</h2>
        <p className="text-muted-foreground">Platform statistics and key metrics</p>
      </div>

      {error && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 p-4 text-sm text-yellow-800 dark:text-yellow-200">
          {error} — showing cached/fallback data.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <div className={`rounded-lg p-2 ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">{card.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent activity placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Activity feed will appear here once the backend endpoints are connected.</p>
        </CardContent>
      </Card>
    </div>
  );
}
