import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import { setAccessToken } from "../../api/http";

export default function OAuthCallBack() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Completing sign-in...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // rename to avoid redeclare collisions
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

    setAccessToken(tokenFromUrl);
    setMessage("Signed in! Redirecting...");
    navigate("/", { replace: true });
  }, [navigate]);

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