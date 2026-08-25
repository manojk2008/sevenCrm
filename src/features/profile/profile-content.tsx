"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/stores/auth-store";
import { getFriendlyErrorMessage } from "@/lib/api";
import { updateMyProfile } from "./api";
import {
  User,
  Mail,
  Phone,
  Shield,
  Key,
  Eye,
  EyeOff,
  Save,
  Palette,
  Clock,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const ROLE_LABELS: Record<string, string> = {
  "super-admin": "Super Admin",
  admin: "Admin",
  "sales-manager": "Sales Manager",
  "sales-executive": "Sales Executive",
};

const ROLE_COLORS: Record<string, string> = {
  "super-admin": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "sales-manager": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  "sales-executive": "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ProfileContent() {
  const { user, setUser } = useAuthStore();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [department, setDepartment] = useState(user?.department ?? "");

  const handleSaveProfile = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      const updated = await updateMyProfile({
        name: name.trim(),
        department: department.trim(),
      });
      setUser({ ...user, name: updated.name, department: updated.department });
      setName(updated.name);
      setDepartment(updated.department);
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="section-gap">
      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center gap-6 mb-8">
          <Avatar className="size-24 border-4 border-background shadow-elevated">
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
            <p className="text-muted-foreground">{user.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={ROLE_COLORS[user.role]}>
                {ROLE_LABELS[user.role]}
              </Badge>
              <Badge variant="outline">{user.department}</Badge>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="personal" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="personal" className="gap-2">
              <User className="size-4" />
              Personal Info
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="size-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2">
              <Palette className="size-4" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <Clock className="size-4" />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* Personal Info */}
          <TabsContent value="personal">
            <motion.div variants={itemVariants}>
              <Card className="rounded-xl shadow-card">
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your personal details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input id="email" defaultValue={user.email} className="pl-10" disabled />
                      </div>
                      <p className="text-xs text-muted-foreground">Email can&apos;t be changed here.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input id="phone" placeholder="Not available" className="pl-10" disabled />
                      </div>
                      <p className="text-xs text-muted-foreground">Phone numbers aren&apos;t supported yet.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Input
                        id="department"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex justify-end">
                    <Button onClick={handleSaveProfile} disabled={saving}>
                      {saving ? (
                        <>Saving...</>
                      ) : (
                        <>
                          <Save className="size-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security">
            <motion.div variants={itemVariants} className="space-y-6">
              <Card className="rounded-xl shadow-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Change Password</CardTitle>
                      <CardDescription>Ensure your account stays secure</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
                      Not Available
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="current-password"
                        type={showCurrentPassword ? "text" : "password"}
                        className="pl-10 pr-10"
                        disabled
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        className="pl-10 pr-10"
                        disabled
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input id="confirm-password" type="password" disabled />
                  </div>
                  <Button disabled title="Password changes aren't available yet">
                    Not Available
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Changing your password isn&apos;t supported yet.
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-xl shadow-card">
                <CardHeader>
                  <CardTitle>Two-Factor Authentication</CardTitle>
                  <CardDescription>Add an extra layer of security</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Authenticator App</p>
                      <p className="text-sm text-muted-foreground">
                        Use an authenticator app to generate verification codes
                      </p>
                    </div>
                    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
                      Coming Soon
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Preferences */}
          <TabsContent value="preferences">
            <motion.div variants={itemVariants}>
              <Card className="rounded-xl shadow-card">
                <CardHeader>
                  <CardTitle>Preferences</CardTitle>
                  <CardDescription>Customize your experience</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive email alerts for important updates</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Desktop Notifications</p>
                      <p className="text-sm text-muted-foreground">Show browser push notifications</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Follow-up Reminders</p>
                      <p className="text-sm text-muted-foreground">Get reminded before scheduled follow-ups</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Weekly Digest</p>
                      <p className="text-sm text-muted-foreground">Receive weekly performance summary</p>
                    </div>
                    <Switch />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Compact Mode</p>
                      <p className="text-sm text-muted-foreground">Reduce spacing for more data density</p>
                    </div>
                    <Switch />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Activity */}
          <TabsContent value="activity">
            <motion.div variants={itemVariants}>
              <Card className="rounded-xl shadow-card">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Your recent actions and login history</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { action: "Logged in", detail: "Chrome on Windows", time: "2 minutes ago", icon: CheckCircle },
                      { action: "Updated client", detail: "Tata Consultancy Services", time: "1 hour ago", icon: User },
                      { action: "Created quotation", detail: "QT-2024-0016 for Infosys", time: "3 hours ago", icon: Mail },
                      { action: "Won deal", detail: "Cloud Migration for Wipro", time: "Yesterday", icon: CheckCircle },
                      { action: "Logged in", detail: "Chrome on Windows", time: "Yesterday", icon: Shield },
                      { action: "Updated pipeline", detail: "Moved 3 enquiries to negotiation", time: "2 days ago", icon: User },
                      { action: "Sent quotation", detail: "QT-2024-0015 to HCL Technologies", time: "3 days ago", icon: Mail },
                      { action: "Logged in", detail: "Firefox on macOS", time: "4 days ago", icon: Shield },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-4 py-3">
                        <div className="size-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <item.icon className="size-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.action}</p>
                          <p className="text-sm text-muted-foreground">{item.detail}</p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
