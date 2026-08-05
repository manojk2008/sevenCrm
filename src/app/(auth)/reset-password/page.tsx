"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { LockKeyhole, Eye, EyeOff, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const watchPassword = useWatch({ control, name: "password" });

  const requirements = [
    { label: "At least 8 characters", met: watchPassword.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(watchPassword) },
    { label: "One lowercase letter", met: /[a-z]/.test(watchPassword) },
    { label: "One number", met: /[0-9]/.test(watchPassword) },
    { label: "One special character", met: /[^A-Za-z0-9]/.test(watchPassword) },
  ];

  const strengthScore = requirements.filter(req => req.met).length;
  
  const getStrengthColor = () => {
    if (strengthScore === 0) return "bg-slate-200 dark:bg-slate-800";
    if (strengthScore <= 2) return "bg-red-500";
    if (strengthScore <= 4) return "bg-amber-500";
    return "bg-green-500";
  };

  const onSubmit = async () => {
    if (strengthScore < requirements.length) {
      toast.error("Please meet all password requirements");
      return;
    }

    // Simulate API call
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        toast.success("Password reset successfully!");
        router.push("/login");
        resolve();
      }, 1500);
    });
  };

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl">
          <CardHeader className="space-y-4 pb-6 text-center">
            <div className="mx-auto w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <LockKeyhole className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight">
                Reset Password
              </CardTitle>
              <CardDescription className="text-base">
                Create a new strong password for your account
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className={errors.password ? "border-red-500 pr-10" : "pr-10"}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                <div className="pt-2 space-y-3">
                  <div className="flex gap-1 h-1.5 w-full">
                    {[0, 1, 2, 3, 4].map((index) => (
                      <div 
                        key={index} 
                        className={cn(
                          "h-full flex-1 rounded-full transition-colors duration-300",
                          index < strengthScore ? getStrengthColor() : "bg-slate-200 dark:bg-slate-800"
                        )}
                      />
                    ))}
                  </div>
                  
                  <div className="space-y-1.5">
                    {requirements.map((req, i) => (
                      <div key={i} className="flex items-center text-xs">
                        {req.met ? (
                          <Check className="w-3.5 h-3.5 text-green-500 mr-2 shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-700 mr-2 shrink-0" />
                        )}
                        <span className={req.met ? "text-slate-700 dark:text-slate-300" : "text-slate-500"}>
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    className={errors.confirmPassword ? "border-red-500 pr-10" : "pr-10"}
                    {...register("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-red-500 mt-1">{errors.confirmPassword.message}</p>
                )}
              </div>
              
              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
