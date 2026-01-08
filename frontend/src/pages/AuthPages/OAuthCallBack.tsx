// frontend/src/pages/AuthPages/OAuthCallBack.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import { setAccessToken } from "../../api/http";
import { authApi } from "../../api/authApi";
import { useAuth } from "../../context/AuthContext";

export default function OAuthCallBack() {
  const navigate = useNavigate();
  const { setUser, setOrg } = useAuth();
  const [message, setMessage] = useState("Completing sign-in...");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const params = new URLSearchParams(window.location.search);

      const tokenFromUrl = params.get("accessToken");
      const error = params.get("error");

      if (error) {
        setMessage(`Login failed: ${error}`);
        return;
      }

      if (!tokenFromUrl) {
        setMessage("Login failed. No access token received.");
        return;
      }

      try {
        // 1) store token so API calls are authenticated
        setAccessToken(tokenFromUrl);

        // 2) hydrate auth context (this fixes header + profile immediately)
        setMessage("Loading your account...");
        const [me, org] = await Promise.all([authApi.me(), authApi.orgMe()]);

        if (cancelled) return;

        setUser(me);
        setOrg(org ?? null);

        setMessage("Signed in! Redirecting...");
        navigate("/", { replace: true });
      } catch (e: any) {
        // if anything fails, clear token and go back to signin
        setAccessToken(null);

        const msg =
          e?.response?.data?.message ||
          e?.message ||
          "Google login failed. Please try again.";

        setMessage(msg);
        navigate("/signin", { replace: true });
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [navigate, setOrg, setUser]);

  return (
    <>
      <PageMeta title="OAuth Callback" description="Completing OAuth sign-in" />
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-2xl border border-gray-200 p-6 dark:border-gray-800">
          <p className="text-sm text-gray-700 dark:text-gray-300">{message}</p>
        </div>
      </div>
    </>
  );
}