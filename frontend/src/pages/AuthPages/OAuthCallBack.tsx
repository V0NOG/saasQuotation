import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const OAuthCallBack = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Signing you in...");

  useEffect(() => {
    // Support BOTH:
    // 1) /auth/callback?accessToken=...
    // 2) /auth/callback#access=...
    const query = new URLSearchParams(window.location.search);
    const accessTokenFromQuery = query.get("accessToken");

    const hash = window.location.hash || "";
    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    const accessTokenFromHash = hashParams.get("access");

    const accessToken = accessTokenFromQuery || accessTokenFromHash;

    if (!accessToken) {
      setMessage("Login failed. No access token received.");
      return;
    }

    localStorage.setItem("userToken", accessToken);
    window.dispatchEvent(new Event("userLogin"));

    // Clean URL
    window.history.replaceState({}, document.title, "/auth/callback");

    navigate("/", { replace: true });
  }, [navigate]);

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-lg">{message}</p>
    </div>
  );
};

export default OAuthCallBack;