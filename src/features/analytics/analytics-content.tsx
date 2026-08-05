"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/format";
import { TrendingUp, TrendingDown, Users, Target, Clock, Activity, IndianRupee } from "lucide-react";

// Mock Data
const revenueTrend = [
  { name: "Jan", thisYear: 4000, lastYear: 2400 },
  { name: "Feb", thisYear: 3000, lastYear: 1398 },
  { name: "Mar", thisYear: 2000, lastYear: 9800 },
  { name: "Apr", thisYear: 2780, lastYear: 3908 },
  { name: "May", thisYear: 1890, lastYear: 4800 },
  { name: "Jun", thisYear: 2390, lastYear: 3800 },
  { name: "Jul", thisYear: 3490, lastYear: 4300 },
];

const leadSources = [
  { name: "Organic Search", value: 400, color: "hsl(var(--chart-1))" },
  { name: "Referrals", value: 300, color: "hsl(var(--chart-2))" },
  { name: "Social Media", value: 300, color: "hsl(var(--chart-3))" },
  { name: "Direct", value: 200, color: "hsl(var(--chart-4))" },
];

const funnelData = [
  { stage: "Leads", value: 1000 },
  { stage: "Qualified", value: 750 },
  { stage: "Proposal", value: 500 },
  { stage: "Negotiation", value: 300 },
  { stage: "Won", value: 150 },
];

const execRadarData = [
  { subject: "Deals", A: 120, B: 110, fullMark: 150 },
  { subject: "Revenue", A: 98, B: 130, fullMark: 150 },
  { subject: "Conversion", A: 86, B: 130, fullMark: 150 },
  { subject: "Speed", A: 99, B: 100, fullMark: 150 },
  { subject: "Activity", A: 85, B: 90, fullMark: 150 },
];

const heatmapDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const heatmapHours = Array.from({length: 12}, (_, i) => `${i*2}:00`);

export function AnalyticsContent() {
  const [period, setPeriod] = useState("month");

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
          <p className="text-muted-foreground">Deep dive into your business metrics</p>
        </div>
        <Tabs value={period} onValueChange={setPeriod} className="w-[400px]">
          <TabsList className="grid w-full grid-cols-4 rounded-xl">
            <TabsTrigger value="week" className="rounded-lg">Week</TabsTrigger>
            <TabsTrigger value="month" className="rounded-lg">Month</TabsTrigger>
            <TabsTrigger value="quarter" className="rounded-lg">Quarter</TabsTrigger>
            <TabsTrigger value="year" className="rounded-lg">Year</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPI Scorecard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard title="Total Revenue" value="₹4.2 Cr" trend="+12%" icon={IndianRupee} up />
        <KpiCard title="New Leads" value="842" trend="+5%" icon={Users} up />
        <KpiCard title="Win Rate" value="32%" trend="-2%" icon={Target} up={false} />
        <KpiCard title="Avg Deal Size" value="₹3.5 L" trend="+8%" icon={Activity} up />
        <KpiCard title="Sales Velocity" value="18 days" trend="-3 days" icon={Clock} up />
        <KpiCard title="CAC" value="₹4,500" trend="+15%" icon={TrendingDown} up={false} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Revenue Trends</CardTitle>
            <CardDescription>Comparison with previous period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrend}>
                  <defs>
                    <linearGradient id="colorThisYear" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="thisYear" name="This Period" stroke="hsl(var(--primary))" fill="url(#colorThisYear)" />
                  <Area type="monotone" dataKey="lastYear" name="Last Period" stroke="hsl(var(--muted-foreground))" fill="none" strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Sales Funnel</CardTitle>
            <CardDescription>Conversion across stages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center flex-col gap-2">
               {funnelData.map((stage, idx) => {
                 const width = 100 - (idx * 15);
                 return (
                   <div key={stage.stage} className="w-full flex items-center gap-4">
                     <div className="w-24 text-sm font-medium text-right">{stage.stage}</div>
                     <div className="flex-1 flex items-center">
                       <div 
                          className="h-10 bg-primary rounded-r-full rounded-l-sm flex items-center px-4 text-primary-foreground text-sm font-bold shadow-sm"
                          style={{ width: `${width}%` }}
                        >
                         {stage.value}
                       </div>
                     </div>
                   </div>
                 )
               })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Lead Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={leadSources} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                    {leadSources.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="middle" align="right" layout="vertical" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Executive Radar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={execRadarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={30} domain={[0, 150]} />
                  <Radar name="Executive A" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} />
                  <Radar name="Executive B" dataKey="B" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.6} />
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ title, value, trend, icon: Icon, up }: any) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 flex flex-col justify-between h-full">
        <div className="flex justify-between items-start mb-4">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className="p-2 bg-muted rounded-lg"><Icon className="w-4 h-4 text-muted-foreground" /></div>
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className={`text-xs mt-1 font-medium flex items-center ${up ? 'text-green-500' : 'text-red-500'}`}>
            {up ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {trend} from last period
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
