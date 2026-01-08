// frontend/src/components/auth/SignUpForm.tsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import Button from "../ui/button/Button";
import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../api/authApi";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5050";

function startGoogleOAuth() {
  window.location.href = `${API_BASE}/api/auth/google`;
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true" {...props}>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.2-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.3 0 10.1-2 13.7-5.2l-6.3-5.3C29.5 35.6 26.9 36 24 36c-5.2 0-9.6-3-11.3-7.4l-6.6 5.1C9.3 39.7 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4-3.9 5.2l.1-.1 6.3 5.3C36.5 39.6 44 34 44 24c0-1.3-.1-2.2-.4-3.5z"
      />
    </svg>
  );
}

type PlanChoice = "starter" | "pro";

export default function SignUpForm() {
  const navigate = useNavigate();
  const { setUser, setOrg } = useAuth();

  const [orgName, setOrgName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // ✅ Plan selection (cards)
  const [planChoice, setPlanChoice] = useState<PlanChoice>("starter");
  const [wantsTrial, setWantsTrial] = useState(true); // only meaningful for starter

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPro = planChoice === "pro";

  const primaryCta = useMemo(() => {
    if (isPro) return "Continue to payment";
    return wantsTrial ? "Start free trial" : "Subscribe now";
  }, [isPro, wantsTrial]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!orgName || !firstName || !lastName || !email || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!acceptTerms) {
      setError("Please accept the Terms and Conditions.");
      return;
    }

    try {
      setLoading(true);

      const { user, org } = await authApi.register({
        orgName,
        firstName,
        lastName,
        email,
        password,
      });

      setUser(user);
      setOrg(org ?? null);

      // ✅ Always proceed to Stripe (no skip)
      const { url } = await authApi.createCheckoutSession({
        plan: planChoice,
        trial: !isPro && wantsTrial, // starter can trial; pro always pay now
      });

      window.location.href = url;
    } catch (err: any) {
      setError(err?.response?.data?.message || "Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="w-full max-w-md pt-10 mx-auto">
        <Link
          to="/"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon className="size-5" />
          Back to dashboard
        </Link>
      </div>

      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-6">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90">
              Create Account
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Create your account and choose a plan to get started.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={startGoogleOAuth}
              className="inline-flex items-center justify-center gap-3 py-3 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <GoogleIcon />
              Sign up with Google
            </button>
          </div>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 text-sm text-gray-400 bg-white dark:bg-gray-900">Or</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <Label>Business / Org Name</Label>
              <Input value={orgName} onChange={(e) => setOrgName((e.target as HTMLInputElement).value)} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>First name</Label>
                <Input value={firstName} onChange={(e) => setFirstName((e.target as HTMLInputElement).value)} />
              </div>

              <div>
                <Label>Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName((e.target as HTMLInputElement).value)} />
              </div>
            </div>

            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail((e.target as HTMLInputElement).value)} />
            </div>

            <div>
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
                />
                <span
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500 dark:text-gray-400"
                >
                  {showPassword ? <EyeIcon /> : <EyeCloseIcon />}
                </span>
              </div>
            </div>

            {/* ✅ Modern plan cards */}
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">
                Choose your plan
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setPlanChoice("starter");
                    // keep wantsTrial as-is
                  }}
                  className={[
                    "rounded-2xl border p-4 text-left transition",
                    planChoice === "starter"
                      ? "border-brand-500 bg-brand-50 dark:bg-white/5"
                      : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-transparent dark:hover:bg-white/[0.03]",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white/90">
                        Starter
                      </div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Solo trades • quoting essentials
                      </div>
                    </div>
                    <div
                      className={[
                        "mt-0.5 h-4 w-4 rounded-full border",
                        planChoice === "starter" ? "border-brand-500 bg-brand-500" : "border-gray-300 dark:border-gray-700",
                      ].join(" ")}
                      aria-hidden="true"
                    />
                  </div>

                  <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                    • Quotes + PDF/email<br />
                    • Customer management<br />
                    • Pricebook basics
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPlanChoice("pro");
                    setWantsTrial(false); // pro is pay now
                  }}
                  className={[
                    "rounded-2xl border p-4 text-left transition",
                    planChoice === "pro"
                      ? "border-brand-500 bg-brand-50 dark:bg-white/5"
                      : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-transparent dark:hover:bg-white/[0.03]",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white/90">
                        Pro
                      </div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Teams • automation + controls
                      </div>
                    </div>
                    <div
                      className={[
                        "mt-0.5 h-4 w-4 rounded-full border",
                        planChoice === "pro" ? "border-brand-500 bg-brand-500" : "border-gray-300 dark:border-gray-700",
                      ].join(" ")}
                      aria-hidden="true"
                    />
                  </div>

                  <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                    • Everything in Starter<br />
                    • More automation (soon)<br />
                    • Team roles
                  </div>
                </button>
              </div>

              {/* Trial toggle */}
              <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-800">
                <div>
                  <div className="font-medium text-gray-800 dark:text-white/90">7-day free trial</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Card required. Cancel anytime.
                  </div>
                </div>

                <label className={`inline-flex items-center gap-2 ${isPro ? "opacity-50" : ""}`}>
                  <input
                    type="checkbox"
                    checked={isPro ? false : wantsTrial}
                    onChange={(e) => setWantsTrial(e.target.checked)}
                    disabled={isPro}
                  />
                  <span className="text-gray-700 dark:text-gray-300">Enable</span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox checked={acceptTerms} onChange={setAcceptTerms} />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                I agree to the{" "}
                <Link to="/terms" className="text-brand-500 hover:text-brand-600">
                  Terms and Conditions
                </Link>
              </span>
            </div>

            <Button className="w-full" disabled={loading}>
              {loading ? "Signing up..." : primaryCta}
            </Button>
          </form>

          <p className="mt-6 text-sm text-center text-gray-600 dark:text-gray-400">
            Already have an account?{" "}
            <Link to="/signin" className="text-brand-500 hover:text-brand-600">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}