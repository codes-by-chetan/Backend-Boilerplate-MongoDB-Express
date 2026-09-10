import React, { useState } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Lock, Mail, AlertCircle, CheckCircle2 } from "lucide-react";
import { api } from "../../api/client";

export function LoginModal({ open, onClose, onLoginSuccess }) {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin12345");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const data = await api.login(email, password);
      const accessToken = data?.data?.accessToken || data?.data?.token;
      const refreshToken = data?.data?.refreshToken;
      const user = data?.data?.user;
      if (user && user.role !== "admin") {
        throw new Error("Access denied: Only accounts with the Admin role are authorized to access this portal.");
      }

      setSuccessMsg("Administrator authenticated successfully!");
      setTimeout(() => {
        onLoginSuccess({ accessToken, refreshToken, user });
        onClose();
        setSuccessMsg("");
      }, 500);
    } catch (err) {
      setError(err.message || "Failed to authenticate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          <span>Admin Portal Authentication</span>
        </DialogTitle>
        <DialogDescription>
          Sign in with administrator credentials. Access to real-time telemetry, audit logs, and the version time-machine is strictly restricted to the Admin role.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 py-3">
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
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-muted-foreground" />
            Password
          </label>
          <Input
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
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
    </Dialog>
  );
}
