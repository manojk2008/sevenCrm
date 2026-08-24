"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const leaderboardData = [
  { id: 1, name: 'Rahul Sharma', avatar: 'RS', role: 'Sr. Sales Exec', deals: 12, revenue: 4500000, rate: '24%' },
  { id: 2, name: 'Priya Patel', avatar: 'PP', role: 'Sales Exec', deals: 9, revenue: 3200000, rate: '18%' },
  { id: 3, name: 'Amit Singh', avatar: 'AS', role: 'Account Mgr', deals: 7, revenue: 2800000, rate: '21%' },
  { id: 4, name: 'Neha Gupta', avatar: 'NG', role: 'Sales Exec', deals: 5, revenue: 1500000, rate: '15%' },
];

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
};

export function ExecutiveLeaderboard() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.7 }}
      className="h-full"
    >
      <Card className="h-full rounded-xl shadow-sm flex flex-col">
        <CardHeader className="pb-4 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              Executive Leaderboard
              <Trophy className="w-4 h-4 text-amber-500" />
            </CardTitle>
            <CardDescription>Top performers this month</CardDescription>
          </div>
          <select className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500">
            <option>This Month</option>
            <option>Last Month</option>
            <option>This Quarter</option>
          </select>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-muted/40 border-b border-border">
              <tr>
                <th className="px-6 py-3 font-semibold">Rank</th>
                <th className="px-6 py-3 font-semibold">Executive</th>
                <th className="px-6 py-3 font-semibold text-center">Deals Won</th>
                <th className="px-6 py-3 font-semibold text-right">Revenue</th>
                <th className="px-6 py-3 font-semibold text-right">Win Rate</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardData.map((user, idx) => (
                <tr 
                  key={user.id} 
                  className="bg-white dark:bg-transparent border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors"
                >
                  <td className="px-6 py-4 font-medium">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      idx === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" :
                      idx === 1 ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300" :
                      idx === 2 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" :
                      "text-slate-500"
                    )}>
                      #{idx + 1}
                    </div>
                  </td>
                  <td className="px-6 py-4 flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-inner",
                      idx === 0 ? "bg-gradient-to-br from-indigo-500 to-purple-600" : 
                      "bg-slate-300 dark:bg-slate-700 text-foreground"
                    )}>
                      {user.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{user.name}</p>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{user.role}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-medium">
                    <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 px-2.5 py-0.5 rounded-full text-xs">
                      {user.deals}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-semibold">
                    {formatCurrency(user.revenue)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {user.rate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </motion.div>
  );
}
