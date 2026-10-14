"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setStoredUser } from "@/lib/userSession";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Remove anti-autofill clearing so saved credentials can populate

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const submittedUsername = ((form.elements.namedItem("username") as HTMLInputElement)?.value ?? username).trim();
    const submittedPassword = (form.elements.namedItem("password") as HTMLInputElement)?.value ?? password;

    if (!submittedUsername) {
      setError("Username or Email is required");
      return;
    }
    if (!submittedPassword) {
      setError("Password is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: submittedUsername, password: submittedPassword }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.user) {
          setStoredUser(data.user);
        }
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(data.message || "Invalid username or password");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800">
        <div className="text-center flex flex-col items-center">
          {/* Imperial IT Logo */}
          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center shadow-md shadow-blue-900/10 mb-3 shrink-0 p-2">
            <img
              src="/database/pad.png"
              alt="Imperial IT Logo"
              className="w-full h-full object-contain"
            />
          </div>

          <h2 className="text-center text-3xl font-extrabold text-[#0D47A1] dark:text-[#E3F2FD] tracking-tight">
            Imperial IT
          </h2>
          <p className="mt-1 text-center text-xs font-semibold italic text-[#2196F3]">
            The complete IT solution
          </p>
          <p className="mt-3 text-center text-sm text-slate-600 dark:text-slate-400">
            Enter your username and password to log in
          </p>
        </div>

        {/* Form with browser autofill and credential manager support */}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit} autoComplete="on">
          {/* Username Field */}
          <div>
            <label htmlFor="username" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Username or Email
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                name="username"
                id="username"
                required
                autoComplete="username"
                className="appearance-none rounded-lg relative block w-full px-3 py-2.5 border border-[#90CAF9] dark:border-slate-700 placeholder-slate-400 text-slate-900 dark:text-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] text-sm font-medium"
                placeholder="Enter Username or Email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Password
            </label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                id="password"
                required
                autoComplete="current-password"
                className="appearance-none rounded-lg relative block w-full px-3 py-2.5 pr-10 border border-[#90CAF9] dark:border-slate-700 placeholder-slate-400 text-slate-900 dark:text-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] text-sm"
                placeholder="Enter Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-200 text-xs font-medium focus:outline-none px-1 py-1"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-xs text-center font-medium bg-red-50 dark:bg-red-950/20 p-2.5 rounded-lg border border-red-200 dark:border-red-900/40">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 text-sm font-bold rounded-lg text-white bg-[#2196F3] hover:bg-[#1E88E5] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2196F3] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-500/25 active:scale-95"
            >
              {loading ? "Authenticating..." : "Log in"}
            </button>
          </div>

          <div className="text-center text-xs pt-2">
            <Link href="/change-password" className="font-semibold text-[#2196F3] hover:text-[#0D47A1] dark:hover:text-[#90CAF9] transition-colors">
              Forgot / Change Password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
