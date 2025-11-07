import { useEffect, useState } from "react";
import AuthLanding from "./pages/AuthLanding.jsx";
import CovenantApp from "./CovenantApp.jsx";
import { apiRequest } from "./lib/api.js";

const SESSION_KEY = "covenant-session";

function clearStoredSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
}

function loadStoredSession() {
  if (typeof window === "undefined") return null;
  const fromLocal = window.localStorage.getItem(SESSION_KEY);
  if (fromLocal) {
    try {
      return JSON.parse(fromLocal);
    } catch (error) {
      window.localStorage.removeItem(SESSION_KEY);
    }
  }
  const fromSession = window.sessionStorage.getItem(SESSION_KEY);
  if (fromSession) {
    try {
      return JSON.parse(fromSession);
    } catch (error) {
      window.sessionStorage.removeItem(SESSION_KEY);
    }
  }
  return null;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const token = session?.token;

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const stored = loadStoredSession();
      if (!stored?.token) {
        setBootstrapping(false);
        return;
      }
      try {
        const data = await apiRequest(stored.token, "/api/me");
        if (!cancelled) {
          setSession({ token: stored.token, user: data.user });
        }
      } catch (error) {
        clearStoredSession();
        if (!cancelled) {
          setSession(null);
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    };
    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAuthenticated = (nextSession) => {
    setSession({ token: nextSession.token, user: nextSession.user });
    if (typeof window !== "undefined") {
      clearStoredSession();
      const storage = nextSession.remember ? window.localStorage : window.sessionStorage;
      storage.setItem(SESSION_KEY, JSON.stringify({ token: nextSession.token }));
    }
  };

  const handleSignOut = () => {
    setSession(null);
    clearStoredSession();
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-stone-400">
        <span className="text-sm tracking-wide">Загрузка…</span>
      </div>
    );
  }

  if (!token) {
    return <AuthLanding onAuthenticated={handleAuthenticated} />;
  }

  return <CovenantApp user={session.user} token={token} onSignOut={handleSignOut} />;
}
