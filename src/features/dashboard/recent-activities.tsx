"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserPlus, ArrowRightLeft, FileText, Trophy, PhoneCall } from "lucide-react";
import { cn } from "@/lib/utils";

const activities = [
  {
    id: 1,
    title: "New Enquiry",
    desc: "TechCorp Inc. interested in CRM solution",
    time: "10 mins ago",
    icon: UserPlus,
    color: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30",
  },
  {
    id: 2,
    title: "Stage Change",
    desc: "Wipro Deal moved to Negotiation",
    time: "2 hours ago",
    icon: ArrowRightLeft,
    color: "text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30",
  },
  {
    id: 3,
    title: "Quotation Sent",
    desc: "Sent proposal to Infosys for ₹12.5L",
    time: "4 hours ago",
    icon: FileText,
    color: "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30",
  },
  {
    id: 4,
    title: "Deal Won!",
    desc: "TCS closed for Annual Enterprise Plan",
    time: "Yesterday",
    icon: Trophy,
    color: "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30",
  },
  {
    id: 5,
    title: "Follow-up Completed",
    desc: "Call with HCL regarding security features",
    time: "Yesterday",
    icon: PhoneCall,
    color: "text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800",
  },
];

export function RecentActivities() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="flex-1 h-full"
    >
      <Card className="h-full rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Recent Activities</CardTitle>
          <CardDescription>Latest actions in the CRM</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden relative p-0">
          <div className="absolute inset-0 overflow-y-auto px-6 pb-6 custom-scrollbar">
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-800 before:to-transparent">
              {activities.map((act, i) => (
                <div key={act.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  {/* Icon */}
                  <div className={cn("flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-slate-950 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10", act.color)}>
                    <act.icon className="w-4 h-4" />
                  </div>
                  
                  {/* Card */}
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-sm">{act.title}</h4>
                      <span className="text-[10px] font-medium text-muted-foreground">{act.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{act.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
