"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { authClient } from "@/src/lib/auth-client";
import { safeReturnTo } from "@/src/lib/utils";

type Mode = "sign-in" | "sign-up" | "forgot" | "reset" | "resend";

export function AuthForm({
  mode,
  token,
  returnTo,
}: {
  mode: Mode;
  token?: string;
  returnTo?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();
    try {
      if (mode === "sign-in") {
        const result = await authClient.signIn.email({ email, password, callbackURL: safeReturnTo(returnTo) });
        if (result.error) throw new Error("Unable to sign in. Check your details and try again.");
        window.location.assign(safeReturnTo(returnTo));
      } else if (mode === "sign-up") {
        const result = await authClient.signUp.email({ name, email, password, callbackURL: "/onboarding" });
        if (result.error) throw new Error("Unable to create your account. Please check your details.");
        setSuccess("Check your inbox to verify your email, then continue to Homi.");
      } else if (mode === "forgot") {
        await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
        setSuccess("If an account exists for that email, a secure reset link is on its way.");
      } else if (mode === "reset") {
        if (!token) throw new Error("This reset link is missing or no longer valid.");
        const result = await authClient.resetPassword({ newPassword: password, token });
        if (result.error) throw new Error("This reset link is invalid or has expired.");
        setSuccess("Your password has been changed. You can now sign in.");
      } else {
        await authClient.sendVerificationEmail({ email, callbackURL: "/onboarding" });
        setSuccess("If that address is eligible, a verification email is on its way.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const content = {
    "sign-in": ["Welcome back", "Sign in to continue caring for your home.", "Sign in"],
    "sign-up": ["Create your Homi", "A private journal for your home starts here.", "Create account"],
    forgot: ["Reset your password", "We’ll send a secure, single-use link if the account exists.", "Send reset link"],
    reset: ["Choose a new password", "Use at least 10 characters that you do not use elsewhere.", "Update password"],
    resend: ["Verify your email", "Enter your email and we’ll send a fresh verification link.", "Resend verification"],
  }[mode];

  return (
    <div className="auth-card">
      <h1>{content[0]}</h1>
      <p className="auth-subtitle">{content[1]}</p>
      <form className="auth-form" onSubmit={submit} noValidate>
        {mode === "sign-up" && <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" autoComplete="name" required minLength={2} /></div>}
        {mode !== "reset" && <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" inputMode="email" required /></div>}
        {(mode === "sign-in" || mode === "sign-up" || mode === "reset") && (
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={10} maxLength={128} required />
          </div>
        )}
        {mode === "sign-in" && <div className="form-meta"><label><input type="checkbox" name="remember" /> Keep me signed in</label><Link href="/forgot-password">Forgot password?</Link></div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {success && <p className="form-success" role="status">{success}</p>}
        <button className="button button-large auth-submit" disabled={loading} type="submit">
          {loading ? "Please wait…" : content[2]} {!loading && <ArrowRight size={17} />}
        </button>
      </form>
      {mode === "sign-in" && <p className="auth-footer">New to Homi? <Link href="/sign-up">Create an account</Link></p>}
      {mode === "sign-up" && <p className="auth-footer">Already have an account? <Link href="/sign-in">Sign in</Link></p>}
      {(mode === "forgot" || mode === "reset" || mode === "resend") && <p className="auth-footer"><Link href="/sign-in">Back to sign in</Link></p>}
    </div>
  );
}

