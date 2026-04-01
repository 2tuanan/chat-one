"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { signup } from "@/actions/auth";
import { SignupSchema, type SignupInput } from "@/lib/validation/auth";

const resolveRedirectTarget = (value: string | null) => {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return "/chat";
};

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = resolveRedirectTarget(
    searchParams.get("redirectTo")
  );
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(SignupSchema),
  });

  const applyFieldErrors = (fieldErrors: Record<string, string>) => {
    Object.entries(fieldErrors).forEach(([field, message]) => {
      setError(field as keyof SignupInput, { type: "server", message });
    });
  };

  const onSubmit = (values: SignupInput) => {
    startTransition(async () => {
      const result = await signup(values);

      if (!result) {
        toast.error("Something went wrong. Please try again.");
        return;
      }

      if (result.fieldErrors) {
        applyFieldErrors(result.fieldErrors);
        return;
      }

      if (result.error) {
        toast.error(result.error);
        return;
      }

      router.push(result.redirectTo ?? redirectTarget);
    });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_top,_#ecfeff,_#fff7ed_40%,_#f8fafc_100%)] px-6 py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-8 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Join the chat
            </p>
            <h1 className="text-3xl font-semibold text-slate-900">
              Create your account
            </h1>
            <p className="text-sm text-slate-600">
              Pick a username and secure password to get started.
            </p>
          </div>

          <form
            className="mt-8 space-y-6"
            onSubmit={handleSubmit(onSubmit)}
          >
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                autoComplete="email"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                placeholder="you@company.com"
                {...register("email")}
              />
              {errors.email ? (
                <span className="mt-2 block text-xs text-rose-600">
                  {errors.email.message}
                </span>
              ) : null}
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Username
              <input
                type="text"
                autoComplete="username"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                placeholder="your_handle"
                {...register("username")}
              />
              {errors.username ? (
                <span className="mt-2 block text-xs text-rose-600">
                  {errors.username.message}
                </span>
              ) : null}
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Password
              <input
                type="password"
                autoComplete="new-password"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                placeholder="At least 8 characters"
                {...register("password")}
              />
              {errors.password ? (
                <span className="mt-2 block text-xs text-rose-600">
                  {errors.password.message}
                </span>
              ) : null}
            </label>

            <button
              type="submit"
              disabled={isSubmitting || isPending}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting || isPending ? "Creating..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-slate-900 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
