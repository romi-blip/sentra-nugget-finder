import React, { useState } from 'react';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, MessageSquare, Users, BarChart3, Clock } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { useChatAnalytics } from '@/hooks/useChatAnalytics';
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';

const Analytics = () => {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 90),
    to: new Date(),
  });
  
  const { data: analytics, isLoading, error } = useChatAnalytics(dateRange);

  const chartConfig = {
    questions: {
      label: "Questions",
      color: "hsl(var(--primary))",
    },
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-destructive">Error loading analytics: {error.message}</p>
        </div>
      </div>
    );
  }

  const exportToCsv = (data: any[], filename: string) => {
    if (!data.length) return;
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <>
      <SEO 
        title="Analytics - Chat Insights" 
        description="Comprehensive analytics dashboard for chat interactions and user engagement patterns"
      />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Chat Analytics</h1>
            <p className="text-muted-foreground mt-2">
              Insights into user questions and engagement patterns
            </p>
          </div>
          
          <div className="flex items-center gap-4 mt-4 sm:mt-0">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={dateRange}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      setDateRange({ from: range.from, to: range.to });
                    }
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.totalQuestions || 0}</div>
              <p className="text-xs text-muted-foreground">
                User messages asked
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.uniqueUsers || 0}</div>
              <p className="text-xs text-muted-foreground">
                Users who asked questions
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg per User</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics?.avgQuestionsPerUser ? analytics.avgQuestionsPerUser.toFixed(1) : '0.0'}
              </div>
              <p className="text-xs text-muted-foreground">
                Questions per active user
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.totalConversations || 0}</div>
              <p className="text-xs text-muted-foreground">
                Chat sessions created
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          {/* Questions Over Time Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Questions Over Time</CardTitle>
              <CardDescription>Daily question volume trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics?.timeSeriesData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Line 
                      type="monotone" 
                      dataKey="questions" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Users */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Most Active Users</CardTitle>
                <CardDescription>Users by question count</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => exportToCsv(analytics?.topUsers || [], 'top-users.csv')}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics?.topUsers?.slice(0, 10).map((user, index) => (
                  <div key={user.user_id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{user.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Last active: {user.lastAsked ? format(new Date(user.lastAsked), 'MMM dd') : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm font-medium">{user.questionCount}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Word Cloud */}
          <Card>
            <CardHeader>
              <CardTitle>Popular Keywords</CardTitle>
              <CardDescription>Most frequently mentioned terms</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {analytics?.wordFrequencies?.slice(0, 30).map(({ word, count }) => {
                  const size = Math.max(12, Math.min(24, count * 2));
                  const opacity = Math.max(0.4, Math.min(1, count / 10));
                  
                  return (
                    <span
                      key={word}
                      className="inline-block px-2 py-1 rounded-md bg-primary/10 text-primary transition-colors hover:bg-primary/20"
                      style={{ 
                        fontSize: `${size}px`,
                        opacity: opacity
                      }}
                    >
                      {word} ({count})
                    </span>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Questions */}
        <Card className="mt-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Questions</CardTitle>
              <CardDescription>Latest user inquiries</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => exportToCsv(analytics?.recentQuestions || [], 'recent-questions.csv')}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics?.recentQuestions?.slice(0, 20).map((question) => (
                <div key={question.id} className="border-l-2 border-primary/20 pl-4 py-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">{question.userEmail}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(question.created_at), 'MMM dd, HH:mm')}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {question.conversationTitle && (
                      <span className="font-medium">"{question.conversationTitle}"</span>
                    )}
                  </p>
                  <p className="text-sm">{question.content}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Analytics;