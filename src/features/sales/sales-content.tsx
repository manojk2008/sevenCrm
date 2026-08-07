"use client";

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Target, Clock, Trophy, BadgeIndianRupee } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const mockWonDeals = Array.from({ length: 6 }).map((_, i) => ({
  id: `WD-${i+1}`,
  title: `Enterprise License - Client ${i+1}`,
  client: `Client Company ${i+1}`,
  value: Math.floor(Math.random() * 5000000) + 1000000,
  closeDate: new Date().toLocaleDateString(),
  executive: ['Rahul', 'Priya', 'Amit'][Math.floor(Math.random() * 3)],
  duration: Math.floor(Math.random() * 60) + 15
}));

const mockLostDeals = Array.from({ length: 4 }).map((_, i) => ({
  id: `LD-${i+1}`,
  title: `Standard Plan - Client ${i+5}`,
  client: `Client Company ${i+5}`,
  value: Math.floor(Math.random() * 2000000) + 500000,
  closeDate: new Date().toLocaleDateString(),
  executive: ['Rahul', 'Priya', 'Amit'][Math.floor(Math.random() * 3)],
  reason: ['Budget', 'Competition', 'No Response', 'Feature Gap'][Math.floor(Math.random() * 4)]
}));

const revenueData = [
  { name: 'Jan', value: 4000000 },
  { name: 'Feb', value: 3000000 },
  { name: 'Mar', value: 5000000 },
  { name: 'Apr', value: 2780000 },
  { name: 'May', value: 1890000 },
  { name: 'Jun', value: 2390000 },
];

const lossReasonsData = [
  { name: 'Budget', value: 400 },
  { name: 'Competition', value: 300 },
  { name: 'No Response', value: 300 },
  { name: 'Feature Gap', value: 200 },
];

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const execPerformance = [
  { name: 'Rahul Sharma', role: 'Senior AE', won: 4, lost: 1, revenue: 12500000, target: 15000000 },
  { name: 'Priya Patel', role: 'Account Exec', won: 3, lost: 2, revenue: 8400000, target: 10000000 },
  { name: 'Amit Kumar', role: 'Account Exec', won: 2, lost: 3, revenue: 5200000, target: 10000000 },
];

export function SalesContent() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 space-y-6 max-w-7xl mx-auto"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Sales Overview</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Track performance, won/lost deals, and metrics.</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="rounded-2xl shadow-sm border-slate-200 dark:border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Won Deals</p>
              <Trophy className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <h3 className="text-2xl font-bold">6</h3>
              <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(18450000)}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-2xl shadow-sm border-slate-200 dark:border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Lost Deals</p>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-bold">4</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-slate-200 dark:border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Win Rate</p>
              <TrendingUp className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">60%</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-slate-200 dark:border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Avg Deal Size</p>
              <BadgeIndianRupee className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-bold">{formatCurrency(3075000)}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-slate-200 dark:border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Avg Sales Cycle</p>
              <Clock className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-bold">45 <span className="text-base font-medium text-slate-500">days</span></h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="won" className="w-full">
        <div className="bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl inline-flex mb-6 w-full sm:w-auto">
          <TabsList className="bg-transparent border-none w-full sm:w-auto">
            <TabsTrigger value="won" className="rounded-xl px-6 py-2.5">Won Deals</TabsTrigger>
            <TabsTrigger value="lost" className="rounded-xl px-6 py-2.5">Lost Deals</TabsTrigger>
            <TabsTrigger value="performance" className="rounded-xl px-6 py-2.5">Performance</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="won" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 rounded-2xl shadow-sm border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle>Recent Won Deals</CardTitle>
                <CardDescription>Successfully closed opportunities.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500">
                      <tr>
                        <th className="p-3 font-medium rounded-tl-lg">Deal</th>
                        <th className="p-3 font-medium">Value</th>
                        <th className="p-3 font-medium">Close Date</th>
                        <th className="p-3 font-medium">Exec</th>
                        <th className="p-3 font-medium rounded-tr-lg text-right">Cycle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {mockWonDeals.map(deal => (
                        <tr key={deal.id}>
                          <td className="p-3">
                            <p className="font-medium">{deal.title}</p>
                            <p className="text-xs text-slate-500">{deal.client}</p>
                          </td>
                          <td className="p-3 font-medium text-emerald-600">{formatCurrency(deal.value)}</td>
                          <td className="p-3 text-slate-500">{deal.closeDate}</td>
                          <td className="p-3">{deal.executive}</td>
                          <td className="p-3 text-right">{deal.duration} days</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                      <tr>
                        <td className="p-3 font-bold">Total</td>
                        <td className="p-3 font-bold text-emerald-600">{formatCurrency(mockWonDeals.reduce((a,b)=>a+b.value,0))}</td>
                        <td colSpan={3}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val/1000000}M`} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip formatter={(value) => formatCurrency(typeof value === 'number' ? value : Number(value ?? 0))} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                    <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="lost" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 rounded-2xl shadow-sm border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle>Lost Deals</CardTitle>
                <CardDescription>Opportunities that did not close.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500">
                      <tr>
                        <th className="p-3 font-medium rounded-tl-lg">Deal</th>
                        <th className="p-3 font-medium">Value</th>
                        <th className="p-3 font-medium">Date</th>
                        <th className="p-3 font-medium">Exec</th>
                        <th className="p-3 font-medium rounded-tr-lg text-right">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {mockLostDeals.map(deal => (
                        <tr key={deal.id}>
                          <td className="p-3">
                            <p className="font-medium">{deal.title}</p>
                            <p className="text-xs text-slate-500">{deal.client}</p>
                          </td>
                          <td className="p-3 font-medium">{formatCurrency(deal.value)}</td>
                          <td className="p-3 text-slate-500">{deal.closeDate}</td>
                          <td className="p-3">{deal.executive}</td>
                          <td className="p-3 text-right">
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{deal.reason}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle>Loss Reasons</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={lossReasonsData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {lossReasonsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {execPerformance.map((exec, i) => {
              const progress = (exec.revenue / exec.target) * 100;
              const isTop = i === 0;
              return (
                <Card key={exec.name} className={`rounded-2xl shadow-sm border-slate-200 dark:border-slate-800 relative overflow-hidden ${isTop ? 'ring-2 ring-amber-400 dark:ring-amber-500' : ''}`}>
                  {isTop && (
                    <div className="absolute top-0 right-0 bg-amber-400 text-amber-950 text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center">
                      <Trophy className="w-3 h-3 mr-1" /> Top Performer
                    </div>
                  )}
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                        {exec.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{exec.name}</h3>
                        <p className="text-sm text-slate-500">{exec.role}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl">
                        <p className="text-xs text-slate-500 mb-1">Win/Loss</p>
                        <p className="font-bold">{exec.won} / {exec.lost}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl">
                        <p className="text-xs text-slate-500 mb-1">Conversion</p>
                        <p className="font-bold text-indigo-600 dark:text-indigo-400">{Math.round((exec.won / (exec.won + exec.lost))*100)}%</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Target Achieved</span>
                        <span className="font-bold">{formatCurrency(exec.revenue)}</span>
                      </div>
                      <Progress value={progress} className="h-2 bg-slate-100" indicatorClassName={isTop ? 'bg-amber-400' : 'bg-indigo-600'} />
                      <div className="text-right text-xs text-slate-500">
                        Target: {formatCurrency(exec.target)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
