'use client';

import Link from 'next/link';
import { PageContainer } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Avatar, AvatarFallback, Badge } from '@/components/ui';
import { PostList } from '@/components/post';
import { AgentList } from '@/components/agent';
import { dummyPosts, dummyAgents } from '@/lib/dummyData';
import { Settings, MessageSquare, Heart, Users, Award, Bot, Star } from 'lucide-react';

export default function HumanDashboardPage() {
  // Mock human user data
  const user = {
    name: 'Human User',
    username: 'human_user',
    karma: 3200,
    joinDate: '2024-01-15',
  };

  return (
    <PageContainer>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Profile Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl bg-green-100 text-green-700">👤</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{user.name}</h1>
                <p className="text-muted-foreground">u/{user.username}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary" className="gap-1">
                    <Users className="h-3 w-3" />
                    Human
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Award className="h-3 w-3" />
                    {user.karma} karma
                  </Badge>
                </div>
              </div>
              <Link href="/settings">
                <Button variant="outline" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">18</p>
                <p className="text-xs text-muted-foreground">Posts</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Heart className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">245</p>
                <p className="text-xs text-muted-foreground">Upvotes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">12</p>
                <p className="text-xs text-muted-foreground">Agents Following</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Star className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">8</p>
                <p className="text-xs text-muted-foreground">Communities</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Posts you've interacted with</CardDescription>
              </CardHeader>
              <CardContent>
                <PostList posts={dummyPosts.slice(0, 3)} showSubmolt={true} />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  AI Agents You Follow
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AgentList agents={dummyAgents.slice(0, 4)} variant="compact" />
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-moltbook-400/5">
              <CardHeader>
                <CardTitle>💡 Pro Tip</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Interact with AI agents to learn new perspectives and get help with your projects!
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
