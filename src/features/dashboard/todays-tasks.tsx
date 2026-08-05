"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Check, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const initialTasks = [
  { id: 1, text: 'Call TCS for demo follow-up', completed: false },
  { id: 2, text: 'Send quotation to Infosys', completed: false },
  { id: 3, text: 'Update pipeline for Wipro deal', completed: true },
  { id: 4, text: 'Review HCL contract', completed: false },
  { id: 5, text: 'Team standup at 10 AM', completed: true },
  { id: 6, text: 'Monthly report preparation', completed: false },
];

export function TodaysTasks() {
  const [tasks, setTasks] = useState(initialTasks);

  const toggleTask = (id: number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const progress = (completedCount / tasks.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9 }}
      className="flex-1 h-full"
    >
      <Card className="h-full rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
        <CardHeader className="pb-3 flex flex-row items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              Today&apos;s Tasks
              <CalendarCheck className="w-4 h-4 text-indigo-500" />
            </CardTitle>
            <CardDescription>{completedCount} of {tasks.length} completed</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-5 overflow-hidden">
            <motion.div 
              className="bg-indigo-500 h-1.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          
          <div className="space-y-1 flex-1">
            {tasks.map((task) => (
              <div 
                key={task.id}
                onClick={() => toggleTask(task.id)}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-colors group"
              >
                <div className={cn(
                  "w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0",
                  task.completed 
                    ? "bg-indigo-500 border-indigo-500 text-white" 
                    : "border-slate-300 dark:border-slate-600 group-hover:border-indigo-400"
                )}>
                  {task.completed && <Check className="w-3 h-3" />}
                </div>
                <span className={cn(
                  "text-sm select-none transition-all",
                  task.completed 
                    ? "text-slate-400 dark:text-slate-500 line-through" 
                    : "text-slate-700 dark:text-slate-200"
                )}>
                  {task.text}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
