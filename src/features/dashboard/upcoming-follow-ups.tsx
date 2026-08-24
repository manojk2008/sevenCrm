"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { format, isToday, isTomorrow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Phone, Mail, Users, Calendar, AlertCircle, MonitorPlay, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { listFollowUps, getFollowUpErrorMessage } from "@/features/follow-ups/api";
import type { FollowUp, FollowUpType } from "@/types/follow-up";

/** How many upcoming follow-ups the card shows. */
const VISIBLE_COUNT = 5;

const TypeIcon = ({ type }: { type: FollowUpType }) => {
  switch (type) {
    case 'call': return <Phone className="w-4 h-4" />;
    case 'email': return <Mail className="w-4 h-4" />;
    case 'meeting': return <Users className="w-4 h-4" />;
    case 'demo': return <MonitorPlay className="w-4 h-4" />;
    case 'visit': return <Car className="w-4 h-4" />;
    default: return <Calendar className="w-4 h-4" />;
  }
};

/** "Today, 14:00" / "Tomorrow, 09:30" / "12 Sep, 16:00" — never a fabricated relative date. */
function formatWhen(iso: string): string {
  const date = new Date(iso);
  const time = format(date, 'HH:mm');
  if (isToday(date)) return `Today, ${time}`;
  if (isTomorrow(date)) return `Tomorrow, ${time}`;
  return `${format(date, 'd MMM')}, ${time}`;
}

export function UpcomingFollowUps() {
  const router = useRouter();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      // Two narrow queries rather than one broad one: the list is the next
      // few scheduled follow-ups (the backend already orders by scheduledAt
      // ascending), and the badge only needs the overdue *count*, which the
      // paginated response's `total` gives without fetching the rows.
      const [upcoming, overdue] = await Promise.all([
        listFollowUps({ status: 'scheduled', pageSize: VISIBLE_COUNT }),
        listFollowUps({ overdue: true, pageSize: 1 }),
      ]);
      setFollowUps(upcoming.data);
      setOverdueCount(overdue.total);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(getFollowUpErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="flex-1 h-full"
    >
      <Card className="h-full rounded-xl shadow-sm flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold">Upcoming Follow-ups</CardTitle>
              <CardDescription>Scheduled client interactions</CardDescription>
            </div>
            {/* Only rendered when there genuinely are overdue follow-ups. */}
            {overdueCount > 0 && (
              <div className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {overdueCount} Overdue
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 px-4 sm:px-6">
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <Skeleton key={idx} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          )}

          {!isLoading && errorMessage && (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
              <button
                onClick={load}
                className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {!isLoading && !errorMessage && followUps.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No follow-ups scheduled.
            </div>
          )}

          {!isLoading && !errorMessage && followUps.length > 0 && (
            <div className="space-y-3">
              {followUps.map((item) => (
                <button
                  key={item.id}
                  onClick={() => router.push('/follow-ups')}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border flex items-start gap-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50",
                    // Derived by the backend, never a stored status.
                    item.isOverdue ? "border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-900/10" : "border-border"
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
                      <p className="text-sm font-semibold truncate pr-2">{item.client.companyName}</p>
                      <span className={cn(
                        "text-xs font-medium whitespace-nowrap",
                        item.isOverdue ? "text-rose-600 dark:text-rose-400 font-bold" : "text-muted-foreground"
                      )}>
                        {formatWhen(item.scheduledAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{item.subject}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="pt-2 pb-4">
          <button
            onClick={() => router.push('/follow-ups')}
            className="w-full text-center text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
          >
            View All Follow-ups
          </button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
