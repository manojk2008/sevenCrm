"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

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
  const shouldReduceMotion = useReducedMotion();

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
    if (shouldReduceMotion) return;
    setIsShake(true);
    setTimeout(() => setIsShake(false), 500);
  };

  const onSubmit = async (data: LoginFormValues) => {
    try {
      await login(data.email, data.password);
      // No success toast — the redirect to the dashboard is the confirmation.
      router.replace("/dashboard");
    } catch {
      triggerShake();
      toast.error("Invalid email or password");
    }
  };

  return (
    <div className="flex min-h-screen w-full">
      {/* Left Panel - Hidden on Mobile.
          Flat surface, no gradient and no ambient shapes. The content is
          what the product actually contains, not invented proof. */}
      <div className="hidden w-1/2 flex-col justify-between bg-auth-panel p-12 text-auth-panel-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-auth-panel-foreground">
            <span className="text-xl font-bold text-auth-panel">7</span>
          </div>
          <span className="text-2xl font-bold tracking-tight">SevenCRM</span>
        </div>

        <div className="max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Every client, enquiry and quotation in one place.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-auth-panel-muted">
            Track the pipeline from first enquiry through quotation to closed
            sale, with the reporting to see where deals stall.
          </p>
        </div>

        <dl className="border-t border-auth-panel-rule pt-8">
          <dt className="text-xs font-semibold uppercase tracking-wider text-auth-panel-muted">
            In this workspace
          </dt>
          <dd className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-auth-panel-foreground">
            <span>Clients</span>
            <span className="text-auth-panel-rule" aria-hidden="true">/</span>
            <span>Enquiries</span>
            <span className="text-auth-panel-rule" aria-hidden="true">/</span>
            <span>Quotations</span>
            <span className="text-auth-panel-rule" aria-hidden="true">/</span>
            <span>Sales</span>
            <span className="text-auth-panel-rule" aria-hidden="true">/</span>
            <span>Reports</span>
          </dd>
        </dl>
      </div>

      {/* Right Panel - Form */}
      <div className="flex w-full flex-col items-center justify-center bg-background p-6 sm:p-12 lg:w-1/2">

        {/* Mobile Logo */}
        <div className="mb-12 flex items-center gap-2 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="font-bold text-primary-foreground">7</span>
          </div>
          <span className="text-xl font-bold tracking-tight">SevenCRM</span>
        </div>

        <div className="w-full max-w-[440px]">
          <div className="mb-8 text-center sm:text-left">
            <h2 className="mb-2 text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground">Sign in to your account to continue</p>
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
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  {...register("email")}
                />
                <AnimatePresence>
                  {errors.email && (
                    <motion.p
                      id="email-error"
                      role="alert"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-sm text-destructive"
                    >
                      {errors.email.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="pr-10"
                    aria-invalid={errors.password ? true : undefined}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <AnimatePresence>
                  {errors.password && (
                    <motion.p
                      id="password-error"
                      role="alert"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-sm text-destructive"
                    >
                      {errors.password.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}