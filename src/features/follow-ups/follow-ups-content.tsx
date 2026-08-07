"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, List as ListIcon, 
  Plus, Search, PhoneCall, Mail, Users, MonitorPlay, Car,
  ChevronLeft, ChevronRight, CheckCircle2, Clock
} from 'lucide-react';
import { 
  startOfMonth, endOfMonth, eachDayOfInterval, format, 
  isSameMonth, isToday, addMonths, subMonths, isSameDay
} from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FollowUpForm } from './follow-up-form';

type FollowUpType = 'Call' | 'Email' | 'Meeting' | 'Demo' | 'Visit';
type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';
type Status = 'Pending' | 'Completed' | 'Cancelled';

type FollowUp = {
  id: string;
  client: string;
  subject: string;
  type: FollowUpType;
  date: Date;
  priority: Priority;
  status: Status;
  executive: string;
};

// Generate some mock data around current date
const generateMockData = (): FollowUp[] => {
  const data: FollowUp[] = [];
  const today = new Date();
  
  for (let i = 0; i < 30; i++) {
    const daysOffset = Math.floor(Math.random() * 30) - 15; // -15 to +15 days
    const date = new Date(today);
    date.setDate(today.getDate() + daysOffset);
    date.setHours(Math.floor(Math.random() * 8) + 9, 0, 0, 0); // 9 AM to 5 PM
    
    const types: FollowUpType[] = ['Call', 'Email', 'Meeting', 'Demo', 'Visit'];
    const priorities: Priority[] = ['Low', 'Medium', 'High', 'Urgent'];
    const status: Status = daysOffset < 0 ? (Math.random() > 0.3 ? 'Completed' : 'Pending') : 'Pending';

    data.push({
      id: `FU-${Math.floor(Math.random() * 10000)}`,
      client: `Tech Corp ${i + 1}`,
      subject: `Follow up on proposal ${i + 1}`,
      type: types[Math.floor(Math.random() * types.length)],
      date,
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      status: status as Status,
      executive: 'John Doe',
    });
  }
  return data.sort((a, b) => a.date.getTime() - b.date.getTime());
};

const mockFollowUps = generateMockData();

const TypeIcon = ({ type, className }: { type: FollowUpType, className?: string }) => {
  switch (type) {
    case 'Call': return <PhoneCall className={className} />;
    case 'Email': return <Mail className={className} />;
    case 'Meeting': return <Users className={className} />;
    case 'Demo': return <MonitorPlay className={className} />;
    case 'Visit': return <Car className={className} />;
  }
};

const PriorityBadge = ({ priority }: { priority: Priority }) => {
  const colors = {
    Low: 'bg-slate-100 text-slate-700',
    Medium: 'bg-blue-50 text-blue-700 border-blue-200',
    High: 'bg-amber-50 text-amber-700 border-amber-200',
    Urgent: 'bg-red-50 text-red-700 border-red-200'
  };
  return <Badge variant="outline" className={`${colors[priority]} border rounded-md font-normal`}>{priority}</Badge>;
};

export function FollowUpsContent() {
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday
  const endDate = new Date(monthEnd);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // End on Saturday

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getFollowUpsForDate = (date: Date) => 
    mockFollowUps.filter(f => isSameDay(new Date(f.date), date));

  const filteredList = mockFollowUps.filter(f => {
    if (activeTab === 'today') return isToday(new Date(f.date));
    if (activeTab === 'upcoming') return new Date(f.date) > new Date();
    if (activeTab === 'overdue') return new Date(f.date) < new Date() && f.status === 'Pending';
    if (activeTab === 'completed') return f.status === 'Completed';
    return true;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 space-y-6 max-w-7xl mx-auto"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Follow-ups</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Schedule and track client interactions</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="rounded-xl shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Add Follow-up
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <Tabs defaultValue="all" className="w-full sm:w-auto" onValueChange={setActiveTab}>
          <TabsList className="bg-slate-100 dark:bg-slate-800 rounded-xl p-1 h-auto">
            <TabsTrigger value="all" className="rounded-lg px-4 py-2">All</TabsTrigger>
            <TabsTrigger value="today" className="rounded-lg px-4 py-2">Today</TabsTrigger>
            <TabsTrigger value="upcoming" className="rounded-lg px-4 py-2">Upcoming</TabsTrigger>
            <TabsTrigger value="overdue" className="rounded-lg px-4 py-2">Overdue</TabsTrigger>
            <TabsTrigger value="completed" className="rounded-lg px-4 py-2">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="flex items-center space-x-2">
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center">
            <Button 
              variant={view === 'calendar' ? 'default' : 'ghost'} 
              size="icon" 
              className={`rounded-lg h-8 w-8 ${view === 'calendar' ? 'shadow-sm' : ''}`}
              onClick={() => setView('calendar')}
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
            <Button 
              variant={view === 'list' ? 'default' : 'ghost'} 
              size="icon"
              className={`rounded-lg h-8 w-8 ${view === 'list' ? 'shadow-sm' : ''}`}
              onClick={() => setView('list')}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === 'calendar' ? (
          <motion.div 
            key="calendar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">{format(currentDate, 'MMMM yyyy')}</h2>
                <div className="flex space-x-2">
                  <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="rounded-xl h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="rounded-xl h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="bg-slate-50 dark:bg-slate-950/50 p-2 text-center text-sm font-medium text-slate-500">
                    {day}
                  </div>
                ))}
                
                {calendarDays.map((day, idx) => {
                  const dayFollowUps = getFollowUpsForDate(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isDaySelected = selectedDate && isSameDay(day, selectedDate);
                  
                  return (
                    <div 
                      key={idx} 
                      onClick={() => setSelectedDate(day)}
                      className={`min-h-[100px] bg-white dark:bg-slate-900 p-2 transition-colors cursor-pointer border-t border-slate-100 dark:border-slate-800/50
                        ${!isCurrentMonth ? 'text-slate-400 bg-slate-50/50 dark:bg-slate-900/50' : ''}
                        ${isToday(day) ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}
                        ${isDaySelected ? 'ring-2 ring-inset ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}
                      `}
                    >
                      <div className={`text-right text-sm font-medium p-1
                        ${isToday(day) ? 'bg-indigo-600 text-white rounded-full w-7 h-7 flex items-center justify-center ml-auto' : ''}
                      `}>
                        {format(day, 'd')}
                      </div>
                      
                      <div className="mt-2 flex flex-col gap-1">
                        {dayFollowUps.slice(0, 3).map(f => (
                          <div key={f.id} className="text-xs truncate px-1.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${f.priority === 'Urgent' ? 'bg-red-500' : f.priority === 'High' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                            {f.client}
                          </div>
                        ))}
                        {dayFollowUps.length > 3 && (
                          <div className="text-xs text-slate-500 font-medium pl-1">+{dayFollowUps.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col h-full max-h-[800px]">
              <h3 className="font-semibold text-lg mb-4 flex items-center">
                {selectedDate ? (isToday(selectedDate) ? 'Today' : format(selectedDate, 'MMMM d, yyyy')) : 'Select a date'}
              </h3>
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                {selectedDate && getFollowUpsForDate(selectedDate).length > 0 ? (
                  getFollowUpsForDate(selectedDate).map(f => (
                    <div key={f.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900 transition-colors bg-slate-50/50 dark:bg-slate-900/50 group">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400">
                            <TypeIcon type={f.type} className="w-4 h-4" />
                          </div>
                          <span className="font-semibold">{f.client}</span>
                        </div>
                        <PriorityBadge priority={f.priority} />
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{f.subject}</p>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {format(f.date, 'h:mm a')}
                        </div>
                        <Badge variant={f.status === 'Completed' ? 'default' : 'secondary'} className={f.status === 'Completed' ? 'bg-emerald-500' : ''}>
                          {f.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 py-12">
                    <CalendarIcon className="w-12 h-12 opacity-20" />
                    <p>No follow-ups for this date</p>
                    <Button variant="outline" className="rounded-xl" onClick={() => setIsFormOpen(true)}>
                      Schedule one
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-medium">Client / Subject</th>
                    <th className="px-6 py-4 font-medium">Type</th>
                    <th className="px-6 py-4 font-medium">Date & Time</th>
                    <th className="px-6 py-4 font-medium">Priority</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Executive</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredList.map(row => {
                    const isOverdue = new Date(row.date) < new Date() && row.status === 'Pending';
                    return (
                      <tr key={row.id} className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-950/50 ${isOverdue ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{row.client}</div>
                          <div className="text-slate-500 text-xs mt-0.5">{row.subject}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <TypeIcon type={row.type} className="w-4 h-4 text-slate-400" />
                            <span>{row.type}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
                            {format(row.date, 'MMM d, yyyy')}
                          </div>
                          <div className="text-slate-500 text-xs mt-0.5">{format(row.date, 'h:mm a')}</div>
                        </td>
                        <td className="px-6 py-4"><PriorityBadge priority={row.priority} /></td>
                        <td className="px-6 py-4">
                          <Badge variant={row.status === 'Completed' ? 'default' : row.status === 'Cancelled' ? 'destructive' : 'secondary'} 
                                 className={row.status === 'Completed' ? 'bg-emerald-500' : ''}>
                            {row.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">{row.executive}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {row.status === 'Pending' && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50">
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="outline" size="sm" className="h-8 rounded-lg">View</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredList.length === 0 && (
                <div className="py-12 text-center text-slate-500">
                  No follow-ups found for this filter.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <FollowUpForm open={isFormOpen} onOpenChange={setIsFormOpen} />
    </motion.div>
  );
}
