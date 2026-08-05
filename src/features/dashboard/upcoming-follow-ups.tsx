"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Phone, Mail, Users, Calendar, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const followUps = [
  {
    id: 1,
    client: "Reliance Retail",
    subject: "Finalize Pricing Contract",
    date: "Today, 14:00",
    type: 'call',
    priority: 'high',
    overdue: false,
  },
  {
    id: 2,
    client: "Mahindra Group",
    subject: "Product Demo Session",
    date: "Today, 16:30",
    type: 'meeting',
    priority: 'medium',
    overdue: false,
  },
  {
    id: 3,
    client: "Adani Enterprises",
    subject: "Send revised quotation",
    date: "Yesterday",
    type: 'email',
    priority: 'high',
    overdue: true,
  },
  {
    id: 4,
    client: "Tata Motors",
    subject: "Initial Discovery Call",
    date: "Tomorrow, 10:00",
    type: 'call',
    priority: 'low',
    overdue: false,
  },
  {
    id: 5,
    client: "Bajaj Finserv",
    subject: "Onsite implementation prep",
    date: "Thu, 11:00",
    type: 'meeting',
    priority: 'medium',
    overdue: false,
  },
];

const TypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'call': return <Phone className="w-4 h-4" />;
    case 'email': return <Mail className="w-4 h-4" />;
    case 'meeting': return <Users className="w-4 h-4" />;
    default: return <Calendar className="w-4 h-4" />;
  }
};

export function UpcomingFollowUps() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="flex-1 h-full"
    >
      <Card className="h-full rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold">Upcoming Follow-ups</CardTitle>
              <CardDescription>Scheduled tasks and meetings</CardDescription>
            </div>
            <div className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              1 Overdue
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 px-4 sm:px-6">
          <div className="space-y-3">
            {followUps.map((item) => (
              <div 
                key={item.id} 
                className={cn(
                  "p-3 rounded-xl border flex items-start gap-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50",
                  item.overdue ? "border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-900/10" : "border-slate-100 dark:border-slate-800"
                )}
              >
                <div className={cn(
                  "mt-0.5 p-2 rounded-lg shrink-0",
                  item.type === 'call' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                  item.type === 'email' ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" :
                  "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                )}>
                  <TypeIcon type={item.type} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-semibold truncate pr-2">{item.client}</p>
                    <span className={cn(
                      "text-xs font-medium whitespace-nowrap",
                      item.overdue ? "text-rose-600 dark:text-rose-400 font-bold" : "text-muted-foreground"
                    )}>
                      {item.date}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{item.subject}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="pt-2 pb-4">
          <button className="w-full text-center text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
            View All Tasks
          </button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
