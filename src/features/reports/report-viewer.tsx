"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { ArrowLeft, Download, Printer, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { formatCurrency } from "@/lib/format";

// Mock Data
const salesData = [
  { name: "Jan", won: 45, revenue: 1500000, avg: 33333, rate: 25 },
  { name: "Feb", won: 52, revenue: 1800000, avg: 34615, rate: 28 },
  { name: "Mar", won: 61, revenue: 2200000, avg: 36065, rate: 32 },
  { name: "Apr", won: 48, revenue: 1600000, avg: 33333, rate: 26 },
  { name: "May", won: 55, revenue: 2000000, avg: 36363, rate: 29 },
  { name: "Jun", won: 65, revenue: 2500000, avg: 38461, rate: 35 },
  { name: "Jul", won: 70, revenue: 2800000, avg: 40000, rate: 38 },
  { name: "Aug", won: 68, revenue: 2600000, avg: 38235, rate: 36 },
  { name: "Sep", won: 75, revenue: 3100000, avg: 41333, rate: 41 },
  { name: "Oct", won: 82, revenue: 3500000, avg: 42682, rate: 45 },
  { name: "Nov", won: 85, revenue: 3800000, avg: 44705, rate: 47 },
  { name: "Dec", won: 95, revenue: 4500000, avg: 47368, rate: 52 },
];

const revenueByClientData = [
  { name: "Acme Corp", value: 1250000 },
  { name: "Globex Inc", value: 980000 },
  { name: "Soylent Corp", value: 850000 },
  { name: "Initech", value: 720000 },
  { name: "Umbrella Corp", value: 650000 },
];

const revenueByProductData = [
  { name: "Enterprise ERP", value: 4500000 },
  { name: "Cloud Storage", value: 3200000 },
  { name: "Consulting", value: 2100000 },
  { name: "Support SLA", value: 1800000 },
];

const executiveData = [
  { name: "Rahul Sharma", deals: 145, revenue: 5500000, rate: 32, cycle: 18 },
  { name: "Priya Patel", deals: 128, revenue: 4800000, rate: 28, cycle: 22 },
  { name: "Amit Kumar", deals: 112, revenue: 4200000, rate: 25, cycle: 25 },
  { name: "Neha Singh", deals: 156, revenue: 6100000, rate: 35, cycle: 15 },
];

// Categorical series colours. These were the Recharts documentation defaults;
// they now come from the app's chart ramp so they follow the active theme.
const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface ReportViewerProps {
  type: string;
}

export function ReportViewer({ type }: ReportViewerProps) {
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), 0, 1),
    to: new Date(),
  });

  const handleExportCSV = () => toast.success("Exported to CSV");
  const handleExportExcel = () => toast.success("Exported to Excel");
  const handlePrint = () => window.print();

  const getReportTitle = () => {
    return type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') + " Report";
  };

  const renderSalesChart = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-xl">
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground">Total Revenue</div>
            <div className="text-2xl font-bold mt-2">{formatCurrency(31900000)}</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground">Avg Deal Size</div>
            <div className="text-2xl font-bold mt-2">{formatCurrency(39875)}</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground">Best Month</div>
            <div className="text-2xl font-bold mt-2">December</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground">Total Deals Won</div>
            <div className="text-2xl font-bold mt-2">801</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Monthly Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value / 100000}L`} />
                <RechartsTooltip 
                  cursor={{fill: 'var(--muted)', opacity: 0.2}}
                  contentStyle={{borderRadius: '8px', border: '1px solid var(--border)'}}
                  formatter={(value) => formatCurrency(typeof value === 'number' ? value : Number(value ?? 0))}
                />
                <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Sales Data Table</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Deals Won</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Avg Deal Size</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesData.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right">{row.won}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.avg)}</TableCell>
                  <TableCell className="text-right">{row.rate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderRevenueChart = () => (
    <div className="space-y-6">
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Cumulative Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(val) => `₹${val/100000}L`} />
                <RechartsTooltip formatter={(value) => formatCurrency(typeof value === 'number' ? value : Number(value ?? 0))}/>
                <Area type="monotone" dataKey="revenue" stroke="var(--primary)" fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Top Clients by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={revenueByClientData} margin={{top: 5, right: 30, left: 40, bottom: 5}}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(val) => `₹${val/100000}L`} />
                  <YAxis dataKey="name" type="category" width={80} />
                  <RechartsTooltip formatter={(value) => formatCurrency(typeof value === 'number' ? value : Number(value ?? 0))} />
                  <Bar dataKey="value" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Revenue by Product</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueByProductData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {revenueByProductData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => formatCurrency(typeof value === 'number' ? value : Number(value ?? 0))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderExecutiveChart = () => (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {executiveData.map((exec, i) => (
          <Card key={exec.name} className="rounded-xl">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{exec.name}</h3>
                  <p className="text-sm text-muted-foreground">{exec.deals} Deals Won</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {i+1}
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold">{formatCurrency(exec.revenue)}</div>
                <div className="flex items-center text-sm mt-1">
                  <span className="text-green-500 mr-2">Win Rate: {exec.rate}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Executive Performance Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={executiveData} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" tickFormatter={(val) => `₹${val/100000}L`} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => `${val}%`} />
                <RechartsTooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="rate" name="Win Rate (%)" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Link
            href="/reports"
            aria-label="Back to reports"
            className="inline-flex size-8 items-center justify-center rounded-xl border border-border bg-background transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{getReportTitle()}</h2>
            <CardDescription>Detailed analysis and insights</CardDescription>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <DatePickerWithRange date={date} setDate={setDate} />
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {type === 'sales' ? renderSalesChart() : 
       type === 'revenue' ? renderRevenueChart() : 
       type === 'executive' ? renderExecutiveChart() : 
       renderSalesChart()} 
       {/* Fallback to sales chart for other types for this demo */}
    </div>
  );
}
