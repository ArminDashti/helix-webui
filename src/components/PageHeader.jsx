import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "../context/I18nContext.jsx";

export default function PageHeader({
  icon: Icon,
  title,
  actions,
  children,
  backTo,
}) {
  const navigate = useNavigate();
  const { t } = useI18n();

  function goBack() {
    const idx = window.history.state?.idx;
    if (typeof idx === "number" && idx > 0) {
      navigate(-1);
      return;
    }
    if (backTo) {
      navigate(backTo);
    }
  }

  return (
    <header className="flex shrink-0 flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 font-display text-xl text-ink sm:text-2xl">
          {backTo ? (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-fog/40 text-ink hover:bg-fog"
              aria-label={t("common.back")}
            >
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
            </button>
          ) : null}
          {Icon ? <Icon className="size-6 shrink-0" aria-hidden="true" /> : null}
          {title}
        </h1>
        {children}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
