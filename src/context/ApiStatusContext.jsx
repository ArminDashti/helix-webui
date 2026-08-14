import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchHealth, subscribeApiErrors } from "../api/client.js";
import ErrorModal from "../components/ErrorModal.jsx";

const ApiStatusContext = createContext(null);

function summarizeHealth(health) {
  if (!health) return "disconnected";
  const services = [health.database, health.openrouter, health.cursor].filter(
    Boolean,
  );
  const anyIssue = services.some(
    (s) =>
      s.status &&
      s.status !== "connected" &&
      s.status !== "configured",
  );
  if (health.ok && !anyIssue) return "connected";
  if (health.api?.status === "connected") return "degraded";
  return "disconnected";
}

export function ApiStatusProvider({ children }) {
  const [apiError, setApiError] = useState(null);
  const [health, setHealth] = useState(null);
  const [summary, setSummary] = useState("unknown");
  const [checking, setChecking] = useState(false);

  useEffect(() => subscribeApiErrors((err) => setApiError(err)), []);

  const checkConnection = useCallback(async ({ silent = false } = {}) => {
    setChecking(true);
    try {
      const data = await fetchHealth({ silent });
      setHealth(data);
      setSummary(summarizeHealth(data));
      return data;
    } catch {
      setHealth(null);
      setSummary("disconnected");
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkConnection({ silent: false });
    const interval = window.setInterval(() => {
      checkConnection({ silent: true });
    }, 15000);
    function onFocus() {
      checkConnection({ silent: true });
    }
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkConnection]);

  const value = useMemo(
    () => ({
      health,
      summary,
      checking,
      checkConnection,
      apiError,
      clearApiError: () => setApiError(null),
    }),
    [health, summary, checking, checkConnection, apiError],
  );

  return (
    <ApiStatusContext.Provider value={value}>
      {children}
      <ErrorModal error={apiError} onDismiss={() => setApiError(null)} />
    </ApiStatusContext.Provider>
  );
}

export function useApiStatus() {
  const ctx = useContext(ApiStatusContext);
  if (!ctx) {
    throw new Error("useApiStatus must be used within ApiStatusProvider");
  }
  return ctx;
}
