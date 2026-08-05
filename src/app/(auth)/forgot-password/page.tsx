"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, ChevronLeft, CheckCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isSuccess, setIsSuccess] = useState(false);
  
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async () => {
    // Simulate API call
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setIsSuccess(true);
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
              {isSuccess ? <CheckCircle className="w-6 h-6" /> : <KeyRound className="w-6 h-6" />}
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight">
                {isSuccess ? "Check your email" : "Forgot Password"}
              </CardTitle>
              <CardDescription className="text-base">
                {isSuccess 
                  ? `We've sent a password reset link to ${getValues("email")}`
                  : "Enter your email and we'll send you a reset link"}
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent>
            <AnimatePresence mode="wait">
              {!isSuccess ? (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSubmit(onSubmit)}
                  className="space-y-5"
                >
                  <div className="space-y-2 text-left">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@company.com"
                      className={errors.email ? "border-red-500 focus-visible:ring-red-500" : ""}
                      {...register("email")}
                    />
                    {errors.email && (
                      <p className="text-sm text-red-500">{errors.email.message}</p>
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
                        Sending...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </motion.form>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="pt-2"
                >
                  <Link
                    href="/login"
                    className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-slate-900 px-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                  >
                    Return to Login
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
            
            {!isSuccess && (
              <div className="mt-6 text-center">
                <Link 
                  href="/login" 
                  className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back to Login
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
