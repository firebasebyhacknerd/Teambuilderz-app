import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  ShieldCheck,
  Mail,
  Lock,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  CheckCircle,
} from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import API_URL from "../lib/api";
import { motion, AnimatePresence } from "framer-motion";

const LoginPage = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const token = window.localStorage.getItem("token");
    const role = window.localStorage.getItem("userRole");
    if (token && role) {
      router.replace(role === "Admin" ? "/admin" : "/recruiter");
    }
  }, [router]);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Clear previous errors
    setFieldErrors({});
    setErrorMessage("");

    // Validate fields
    const errors = {};
    if (!email.trim()) {
      errors.email = "Email is required";
    } else if (!validateEmail(email)) {
      errors.email = "Please enter a valid email address";
    }

    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload?.message ||
          "Unable to log in. Please verify your credentials.";
        throw new Error(message);
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("token", "session");
        window.localStorage.setItem("userRole", payload?.role || "");
        window.localStorage.setItem("userName", payload?.name || "");
        if (payload?.id) {
          window.localStorage.setItem("userId", String(payload.id));
        }
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.replace(payload?.role === "Admin" ? "/admin" : "/recruiter");
      }, 1000);
    } catch (loginError) {
      const message =
        loginError instanceof Error
          ? loginError.message
          : "Unexpected error during login. Please try again.";
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70"
          animate={{
            x: [0, 100, 0],
            y: [0, -100, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70"
          animate={{
            x: [0, -100, 0],
            y: [0, 100, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-70"
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="w-full p-8 shadow-2xl backdrop-blur-sm bg-white/90 border border-white/20 space-y-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="text-center space-y-3"
          >
            <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white flex items-center justify-center shadow-lg">
              <AnimatePresence mode="wait">
                {isSuccess ? (
                  <motion.div
                    key="success"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1, rotate: 360 }}
                    exit={{ scale: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <Sparkles className="h-8 w-8" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="shield"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ShieldCheck className="h-8 w-8" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div>
              <motion.h1
                className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                TeamBuilderz Access
              </motion.h1>
              <motion.p
                className="text-sm text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              >
                Sign in to monitor candidates and track recruiter activity.
              </motion.p>
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </motion.div>
            )}
            {isSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Login successful! Redirecting...</span>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.form
            onSubmit={handleSubmit}
            className="space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.3 }}
          >
            <div className="space-y-2">
              <Label htmlFor="login-email" className="text-sm font-medium">
                Work Email
              </Label>
              <div className="relative">
                <Mail
                  className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors ${
                    fieldErrors.email ? "text-red-500" : "text-muted-foreground"
                  }`}
                />
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@teambuilderz.us"
                    autoComplete="email"
                    className={`pl-10 transition-all ${
                      fieldErrors.email
                        ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                        : ""
                    }`}
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (fieldErrors.email) {
                        setFieldErrors((prev) => ({ ...prev, email: "" }));
                      }
                    }}
                    disabled={submitting}
                    required
                  />
                </motion.div>
              </div>
              <AnimatePresence>
                {fieldErrors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-xs text-red-600 mt-1"
                  >
                    {fieldErrors.email}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Lock
                  className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors ${
                    fieldErrors.password
                      ? "text-red-500"
                      : "text-muted-foreground"
                  }`}
                />
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className={`pl-10 pr-10 transition-all ${
                      fieldErrors.password
                        ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                        : ""
                    }`}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: "" }));
                      }
                    }}
                    disabled={submitting}
                    required
                  />
                </motion.div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={submitting}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <AnimatePresence>
                {fieldErrors.password && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-xs text-red-600 mt-1"
                  >
                    {fieldErrors.password}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium shadow-lg transition-all duration-200"
                disabled={submitting || isSuccess}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </span>
                ) : isSuccess ? (
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Success!
                  </span>
                ) : (
                  "Sign in"
                )}
              </Button>
            </motion.div>
          </motion.form>

          <motion.p
            className="text-center text-xs text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.3 }}
          >
            Protected access. Reach out to your TeamBuilderz administrator if
            you need help signing in.
          </motion.p>
        </Card>

        {/* Footer branding */}
        <motion.div
          className="text-center mt-6 text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.3 }}
        >
          <p>Powered by TeamBuilderz LLC</p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default LoginPage;

