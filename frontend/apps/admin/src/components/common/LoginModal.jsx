import React, { useState, useEffect } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Lock,
  Mail,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ShieldAlert,
  LifeBuoy,
  ArrowLeft,
  Timer,
  RefreshCw,
  HelpCircle,
} from "lucide-react";
import { api } from "../../api/client";

const UNLOCK_COOLDOWN_KEY = "auth_unlock_email_cooldown";
const RESET_COOLDOWN_KEY = "auth_reset_email_cooldown";

export function LoginModal({
  open,
  onClose,
  onLoginSuccess,
  initialView = "login",
}) {
  // Navigation tabs: "login" | "unlock" | "reset" | "support"
  const [view, setView] = useState(initialView || "login");
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin12345");
  const [unlockToken, setUnlockToken] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [lockoutInfo, setLockoutInfo] = useState(null);

  useEffect(() => {
    if (initialView) {
      setView(initialView);
    }
  }, [initialView]);

  // Cooldown timers (in seconds)
  const [unlockCooldown, setUnlockCooldown] = useState(0);
  const [resetCooldown, setResetCooldown] = useState(0);

  // Restore cooldown timers from localStorage across page refreshes
  useEffect(() => {
    try {
      const storedUnlock = localStorage.getItem(UNLOCK_COOLDOWN_KEY);
      if (storedUnlock) {
        const rem = Math.ceil((Number(storedUnlock) - Date.now()) / 1000);
        if (rem > 0) setUnlockCooldown(rem);
        else localStorage.removeItem(UNLOCK_COOLDOWN_KEY);
      }

      const storedReset = localStorage.getItem(RESET_COOLDOWN_KEY);
      if (storedReset) {
        const rem = Math.ceil((Number(storedReset) - Date.now()) / 1000);
        if (rem > 0) setResetCooldown(rem);
        else localStorage.removeItem(RESET_COOLDOWN_KEY);
      }
    } catch (_) {}
  }, []);

  // Unlock cooldown ticker
  useEffect(() => {
    if (unlockCooldown <= 0) return;
    const interval = setInterval(() => {
      setUnlockCooldown((prev) => {
        if (prev <= 1) {
          localStorage.removeItem(UNLOCK_COOLDOWN_KEY);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [unlockCooldown]);

  // Reset cooldown ticker
  useEffect(() => {
    if (resetCooldown <= 0) return;
    const interval = setInterval(() => {
      setResetCooldown((prev) => {
        if (prev <= 1) {
          localStorage.removeItem(RESET_COOLDOWN_KEY);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [resetCooldown]);

  // Switch view helper with state cleanup
  const switchView = (newView) => {
    setView(newView);
    setError("");
    setSuccessMsg("");
  };

  // Handle Standard Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const data = await api.login(email, password);
      const token = data?.data?.accessToken || data?.data?.token;
      if (!token) throw new Error("No token returned from server");

      setSuccessMsg("Logged in successfully!");
      setLockoutInfo(null);
      setTimeout(() => {
        onLoginSuccess(token);
        onClose();
        setSuccessMsg("");
      }, 500);
    } catch (err) {
      setError(err.message || "Failed to authenticate");
      if (err.status === 403 || err.data?.isLocked) {
        setLockoutInfo(err.data || { isLocked: true, email });
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Requesting an Unlock Link via Email
  const handleRequestUnlock = async (e) => {
    e.preventDefault();
    if (unlockCooldown > 0) return;

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const data = await api.requestUnlock(email);
      const cooldownSecs = data?.data?.cooldownSeconds || 60;
      setUnlockCooldown(cooldownSecs);
      localStorage.setItem(UNLOCK_COOLDOWN_KEY, (Date.now() + cooldownSecs * 1000).toString());
      setSuccessMsg(data?.message || "Unlock link dispatched! Please check your email inbox.");
    } catch (err) {
      if (err.status === 429) {
        const secs = err.data?.cooldownSeconds || 60;
        setUnlockCooldown(secs);
        localStorage.setItem(UNLOCK_COOLDOWN_KEY, (Date.now() + secs * 1000).toString());
      }
      setError(err.message || "Failed to request unlock link");
    } finally {
      setLoading(false);
    }
  };

  // Handle Unlocking Account via Direct Token
  const handleUnlockWithToken = async (e) => {
    e.preventDefault();
    if (!unlockToken.trim()) {
      setError("Please paste your 64-character unlock token.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const data = await api.unlockAccount(unlockToken.trim());
      setSuccessMsg(data?.message || "Account successfully unlocked! You can now sign in.");
      setLockoutInfo(null);
      setUnlockToken("");
      setTimeout(() => {
        switchView("login");
        setSuccessMsg("Account unlocked! Please sign in with your credentials.");
      }, 1200);
    } catch (err) {
      setError(err.message || "Invalid or expired unlock token");
    } finally {
      setLoading(false);
    }
  };

  // Handle Requesting Password Reset Link
  const handleRequestReset = async (e) => {
    e.preventDefault();
    if (resetCooldown > 0) return;

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const data = await api.forgotPassword(email);
      const cooldownSecs = data?.data?.cooldownSeconds || 60;
      setResetCooldown(cooldownSecs);
      localStorage.setItem(RESET_COOLDOWN_KEY, (Date.now() + cooldownSecs * 1000).toString());
      setSuccessMsg(data?.message || "If an account exists, a reset link has been dispatched.");
    } catch (err) {
      if (err.status === 429) {
        const secs = err.data?.cooldownSeconds || 60;
        setResetCooldown(secs);
        localStorage.setItem(RESET_COOLDOWN_KEY, (Date.now() + secs * 1000).toString());
      }
      setError(err.message || "Failed to request password reset");
    } finally {
      setLoading(false);
    }
  };

  // Handle Setting New Password with Token
  const handleResetWithToken = async (e) => {
    e.preventDefault();
    if (!resetToken.trim() || newPassword.length < 8) {
      setError("Please enter the reset token and a new password (min 8 characters).");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const data = await api.resetPassword(resetToken.trim(), newPassword);
      setSuccessMsg(data?.message || "Password updated! Please log in.");
      setResetToken("");
      setNewPassword("");
      setTimeout(() => {
        switchView("login");
        setSuccessMsg("Password reset successfully. Sign in with your new password.");
      }, 1500);
    } catch (err) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      {/* ----------------------------------------------------------------- */}
      {/* 1. SIGN IN VIEW                                                  */}
      {/* ----------------------------------------------------------------- */}
      {view === "login" && (
        <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              <span>Admin Authentication</span>
            </DialogTitle>
            <DialogDescription>
              Sign in with administrator credentials to access real-time telemetry, database audit logs, and version time-machine.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleLogin} className="space-y-4 py-3">
            {/* Lockout Banner with Direct Unlock Action */}
            {lockoutInfo?.isLocked && (
              <div className="p-3.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-500 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
                  <span>Account Temporarily Locked (24 Hours)</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Too many consecutive failed login attempts were detected. Protect your account by unlocking via email or contacting support.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-red-500/40 text-red-400 hover:bg-red-500/20"
                    onClick={() => switchView("unlock")}
                  >
                    Unlock Account
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => switchView("support")}
                  >
                    Account Support
                  </Button>
                </div>
              </div>
            )}

            {error && !lockoutInfo?.isLocked && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-xs">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Mail className="h-3 w-3 text-muted-foreground" />
                Admin Email
              </label>
              <Input
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => switchView("reset")}
                  className="text-[11px] text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <Input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-between pt-1 text-[11px]">
              <button
                type="button"
                onClick={() => switchView("unlock")}
                className="text-amber-500 hover:underline flex items-center gap-1 font-medium"
              >
                <KeyRound className="h-3 w-3" />
                <span>Locked out? Unlock Account</span>
              </button>
              <button
                type="button"
                onClick={() => switchView("support")}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <LifeBuoy className="h-3 w-3" />
                <span>Account Support</span>
              </button>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Authenticating..." : "Sign In"}
              </Button>
            </DialogFooter>
          </form>
        </>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 2. UNLOCK ACCOUNT VIEW                                            */}
      {/* ----------------------------------------------------------------- */}
      {view === "unlock" && (
        <>
          <DialogHeader>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <button
                type="button"
                onClick={() => switchView("login")}
                className="hover:text-foreground flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Sign In</span>
              </button>
            </div>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-amber-500" />
              <span>Self-Service Account Unlock</span>
            </DialogTitle>
            <DialogDescription>
              Locked out after failed password attempts? Restore your access using an email unlock link or an existing unlock token.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-xs">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Option A: Request Email Link */}
            <form onSubmit={handleRequestUnlock} className="p-3.5 rounded-lg border border-border bg-card/60 space-y-3">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" />
                <span>Option 1: Send Unlock Link to Email</span>
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Enter your account email. We'll dispatch a secure, single-use 1-hour cryptographic unlock link.
              </p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-8 text-xs"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={loading || unlockCooldown > 0}
                  className="shrink-0 h-8 text-xs gap-1"
                >
                  {unlockCooldown > 0 ? (
                    <>
                      <Timer className="h-3 w-3 animate-spin" />
                      <span>{unlockCooldown}s</span>
                    </>
                  ) : (
                    "Send Link"
                  )}
                </Button>
              </div>
            </form>

            {/* Option B: Enter Token Directly */}
            <form onSubmit={handleUnlockWithToken} className="p-3.5 rounded-lg border border-border bg-card/60 space-y-3">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-amber-500" />
                <span>Option 2: I Have an Unlock Token</span>
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Received a 64-character token in your email or from support? Paste it below to unlock immediately.
              </p>
              <Input
                type="text"
                placeholder="e.g. 3a7b9c1d4e6f... (64 hex characters)"
                value={unlockToken}
                onChange={(e) => setUnlockToken(e.target.value)}
                className="h-8 text-xs font-mono"
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={loading || !unlockToken.trim()}
                className="w-full h-8 text-xs gap-1.5"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                <span>Verify & Unlock Account</span>
              </Button>
            </form>

            <div className="flex items-center justify-between text-[11px] pt-1">
              <button
                type="button"
                onClick={() => switchView("support")}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <HelpCircle className="h-3 w-3" />
                <span>Still having trouble? Account Support</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 3. FORGOT / RESET PASSWORD VIEW                                   */}
      {/* ----------------------------------------------------------------- */}
      {view === "reset" && (
        <>
          <DialogHeader>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <button
                type="button"
                onClick={() => switchView("login")}
                className="hover:text-foreground flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Sign In</span>
              </button>
            </div>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <span>Reset Your Password</span>
            </DialogTitle>
            <DialogDescription>
              Request a password reset link or enter your reset token to set a new password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-xs">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Request Reset Link */}
            <form onSubmit={handleRequestReset} className="p-3.5 rounded-lg border border-border bg-card/60 space-y-3">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" />
                <span>Step 1: Request Reset Link</span>
              </h4>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-8 text-xs"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={loading || resetCooldown > 0}
                  className="shrink-0 h-8 text-xs gap-1"
                >
                  {resetCooldown > 0 ? (
                    <>
                      <Timer className="h-3 w-3 animate-spin" />
                      <span>{resetCooldown}s</span>
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </div>
            </form>

            {/* Enter Token & New Password */}
            <form onSubmit={handleResetWithToken} className="p-3.5 rounded-lg border border-border bg-card/60 space-y-3">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-emerald-500" />
                <span>Step 2: Enter Token & New Password</span>
              </h4>
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Reset Token (64-hex string)"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
                <Input
                  type="password"
                  placeholder="New Secure Password (min 8 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={loading || !resetToken.trim() || newPassword.length < 8}
                className="w-full h-8 text-xs"
              >
                Update Password & Invalidate Old Sessions
              </Button>
            </form>
          </div>
        </>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 4. ACCOUNT SUPPORT & HELP DESK VIEW                               */}
      {/* ----------------------------------------------------------------- */}
      {view === "support" && (
        <>
          <DialogHeader>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <button
                type="button"
                onClick={() => switchView("login")}
                className="hover:text-foreground flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Sign In</span>
              </button>
            </div>
            <DialogTitle className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-sky-500" />
              <span>Account Security & Support</span>
            </DialogTitle>
            <DialogDescription>
              Guidance for recovering locked administrator and user accounts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs leading-relaxed">
            <div className="p-3.5 rounded-lg border border-border bg-card/60 space-y-2">
              <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                <span>Why Was My Account Locked?</span>
              </h4>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                To prevent automated brute-force attacks and credential stuffing bots from hijacking your account,
                the server automatically freezes any account that records <strong>3 consecutive failed password attempts</strong>.
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-border bg-card/60 space-y-2.5">
              <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                <KeyRound className="h-4 w-4 text-primary" />
                <span>How to Restore Access</span>
              </h4>
              <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-muted-foreground">
                <li>
                  <strong className="text-foreground">Check Your Email:</strong> An automated intrusion alert with an unlock link and password reset link was dispatched to your email address.
                </li>
                <li>
                  <strong className="text-foreground">Self-Service Unlock:</strong> Use the{" "}
                  <button
                    onClick={() => switchView("unlock")}
                    className="text-primary underline hover:no-underline font-medium"
                  >
                    Unlock Account
                  </button>{" "}
                  view to request a fresh link or paste your unlock token.
                </li>
                <li>
                  <strong className="text-foreground">24-Hour Expiration:</strong> The lockout will automatically lift exactly 24 hours after the last failed attempt.
                </li>
              </ul>
            </div>

            <div className="p-3.5 rounded-lg border border-primary/20 bg-primary/5 space-y-1.5">
              <h4 className="font-semibold text-primary flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                <span>Emergency Help Desk</span>
              </h4>
              <p className="text-[11px] text-muted-foreground">
                If you are an administrator locked out without email access, contact the system owner or security team at:
              </p>
              <div className="font-mono text-[11px] text-foreground bg-muted/60 p-2 rounded border border-border/80 select-all">
                {lockoutInfo?.supportEmail || "admin@example.com"}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => switchView("unlock")}
                className="text-xs"
              >
                Go to Unlock Screen
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => switchView("login")}
                className="text-xs"
              >
                Return to Sign In
              </Button>
            </div>
          </div>
        </>
      )}
    </Dialog>
  );
}

export default LoginModal;
