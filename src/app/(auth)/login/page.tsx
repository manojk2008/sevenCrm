"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Quote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import Link from "next/link";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;


export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isShake, setIsShake] = useState(false);
  
  const login = useAuthStore((state) => state.login);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });
  const rememberMe = useWatch({ control, name: "rememberMe" });

  const triggerShake = () => {
    setIsShake(true);
    setTimeout(() => setIsShake(false), 500);
  };

  const onSubmit = async (data: LoginFormValues) => {
    try {
      await login(data.email, data.password);
      toast.success("Welcome back!");
      router.replace("/dashboard");
    } catch {
      triggerShake();
      toast.error("Invalid email or password");
    }
  };

  return (
    <div className="flex min-h-screen w-full">
      {/* Left Panel - Hidden on Mobile */}
      <div className="hidden lg:flex w-1/2 relative bg-indigo-950 overflow-hidden flex-col justify-between p-12 text-white">
        {/* Deep indigo gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 z-0"></div>
        
        {/* Floating Geometric Shapes */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <motion.div 
            animate={{ 
              y: [0, -20, 0],
              rotate: [0, 5, 0]
            }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[10%] left-[15%] w-64 h-64 border border-indigo-500/20 rounded-full"
          />
          <motion.div 
            animate={{ 
              y: [0, 30, 0],
              x: [0, -10, 0]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-[20%] right-[10%] w-96 h-96 bg-gradient-to-br from-indigo-600/10 to-transparent rounded-full blur-2xl"
          />
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-indigo-950 font-bold text-xl">7</span>
          </div>
          <span className="text-2xl font-bold tracking-tight">SevenCRM</span>
        </div>

        <div className="relative z-10 max-w-lg mt-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-4xl font-semibold leading-tight mb-6">
              The smartest way to manage deals and customer relationships.
            </h1>
            
            <div className="relative bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-sm">
              <Quote className="absolute top-6 left-6 w-8 h-8 text-indigo-400/30" />
              <p className="text-indigo-100 text-lg relative z-10 pl-8 pt-2 mb-4 leading-relaxed">
                &ldquo;Since implementing SevenCRM, our sales team&apos;s productivity has skyrocketed. The interface is intuitive, and the insights are game-changing for our bottom line.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-400 to-purple-400 flex items-center justify-center text-sm font-bold">
                  SJ
                </div>
                <div>
                  <p className="font-medium text-white">Sanjay Joshi</p>
                  <p className="text-sm text-indigo-300">VP of Sales, TechCorp India</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-6 pt-12 border-t border-white/10 mt-12">
          <div>
            <p className="text-3xl font-bold text-white mb-1">500+</p>
            <p className="text-sm text-indigo-300">Companies</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-white mb-1">10k+</p>
            <p className="text-sm text-indigo-300">Deals Tracked</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-white mb-1">98%</p>
            <p className="text-sm text-indigo-300">Satisfaction</p>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 bg-white dark:bg-slate-950">
        
        {/* Mobile Logo */}
        <div className="flex lg:hidden items-center gap-2 mb-12">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
            <span className="text-white font-bold">7</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">SevenCRM</span>
        </div>

        <motion.div 
          className="w-full max-w-[440px]"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-8 text-center sm:text-left">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Welcome back</h2>
            <p className="text-slate-500 dark:text-slate-400">Sign in to your account to continue</p>
          </div>

          <motion.div
            animate={isShake ? { x: [-10, 10, -10, 10, 0] } : {}}
            transition={{ duration: 0.4 }}
          >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  className={errors.email ? "border-red-500 focus-visible:ring-red-500" : ""}
                  {...register("email")}
                />
                <AnimatePresence>
                  {errors.email && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-sm text-red-500"
                    >
                      {errors.email.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-medium">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className={errors.password ? "border-red-500 focus-visible:ring-red-500 pr-10" : "pr-10"}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <AnimatePresence>
                  {errors.password && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-sm text-red-500"
                    >
                      {errors.password.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>


              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}