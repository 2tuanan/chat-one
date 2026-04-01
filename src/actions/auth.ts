"use server";

import { ZodError } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  LoginSchema,
  SignupSchema,
  type LoginInput,
  type SignupInput,
} from "@/lib/validation/auth";

export type AuthActionResult = {
  error?: string;
  fieldErrors?: Record<string, string>;
  redirectTo?: string;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeAuthError = (message: string) => {
  if (message.toLowerCase().includes("invalid login credentials")) {
    return "Invalid email or password";
  }

  return message;
};

const toFieldErrors = (error: ZodError): Record<string, string> => {
  const fieldErrors: Record<string, string> = {};

  error.issues.forEach((issue) => {
    const field = issue.path[0];
    if (typeof field === "string" && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  });

  return fieldErrors;
};

export async function login(input: LoginInput): Promise<AuthActionResult> {
  const parsed = LoginSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(parsed.data.email),
    password: parsed.data.password,
  });

  if (error) {
    return { error: normalizeAuthError(error.message) };
  }

  return { redirectTo: "/chat" };
}

export async function signup(input: SignupInput): Promise<AuthActionResult> {
  const parsed = SignupSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createServerSupabaseClient();
  const username = parsed.data.username.trim().toLowerCase();
  const { error } = await supabase.auth.signUp({
    email: normalizeEmail(parsed.data.email),
    password: parsed.data.password,
    options: {
      data: {
        username,
        display_name: username,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { redirectTo: "/chat" };
}

export async function logout(): Promise<AuthActionResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: error.message };
  }

  return { redirectTo: "/login" };
}
