import { X } from "lucide-react";
import IconButton from "./IconButton.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { translateApiError } from "../i18n/apiErrors.js";

/**
 * Modal for varied API failures (network, HTTP, parse, stream).
 */
export default function ErrorModal({ error, onDismiss }) {
  const { t } = useI18n();
  if (!error) return null;

  const localized = translateApiError(t, error);
  const title = localized.title || t("errors.title");
  const message = localized.message || t("errors.generic");
  const detail = localized.detail || "";
  const meta = [
    localized.kind,
    error.status != null ? t("errors.httpMeta", { status: error.status }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-error-title"
    >
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-warn-border bg-paper shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]">
        <header className="shrink-0 border-b border-line/80 px-4 py-3">
          <h2 id="api-error-title" className="font-display text-lg text-warn">
            {title}
          </h2>
          {meta ? <p className="mt-1 text-xs text-muted">{meta}</p> : null}
        </header>

        <div className="space-y-2 px-4 py-3 text-sm text-ink">
          <p>{message}</p>
          {detail && detail !== message ? (
            <p className="rounded-lg border border-line/60 bg-fog/50 px-3 py-2 font-mono text-xs text-muted">
              {detail}
            </p>
          ) : null}
          {error.path ? (
            <p className="text-xs text-muted">
              {t("errors.path", { path: error.path })}
            </p>
          ) : null}
        </div>

        <footer className="flex shrink-0 justify-end border-t border-line/80 px-4 py-3">
          <IconButton
            type="button"
            icon={X}
            onClick={onDismiss}
            className="rounded-xl border border-line bg-fog px-4 py-2 text-sm font-medium text-ink hover:bg-fog/80"
          >
            {t("common.close")}
          </IconButton>
        </footer>
      </div>
    </div>
  );
}
