import { useEffect, useMemo, useState } from "react";
import { User } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";

function ContactEmail() {
  const parts = useMemo(
    () => ({
      user: "arminonline71",
      at: "@",
      domain: "gmail",
      dot: ".",
      tld: "com",
    }),
    [],
  );
  const [href, setHref] = useState("#");

  useEffect(() => {
    const address = `${parts.user}${parts.at}${parts.domain}${parts.dot}${parts.tld}`;
    setHref(`mailto:${address}`);
  }, [parts]);

  return (
    <p className="text-sm text-ink">
      Contact:{" "}
      <a href={href} className="text-moss underline-offset-2 hover:underline">
        {parts.user} [at] {parts.domain} [dot] {parts.tld}
      </a>
    </p>
  );
}

export default function AboutMePage() {
  return (
    <div className="hx-rise mx-auto flex h-full min-h-0 max-w-3xl flex-col gap-5 overflow-y-auto pb-8">
      <PageHeader icon={User} title="About Me">
        <p className="text-sm text-muted">Armin Dashti — vibe coder, conductor of craft.</p>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-[160px_1fr] sm:items-start">
        <div className="overflow-hidden rounded-2xl border border-line/80 bg-fog/40">
          <img
            src="/about-me/armin.png"
            alt="Armin Dashti"
            className="aspect-[4/5] w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              const fallback = e.currentTarget.nextElementSibling;
              if (fallback) fallback.hidden = false;
            }}
          />
          <div
            hidden
            className="flex aspect-[4/5] items-center justify-center px-3 text-center text-xs text-muted"
          >
            Photo placeholder — add `public/about-me/armin.png`
          </div>
        </div>

        <div className="space-y-4 text-[15px] leading-relaxed text-ink">
          <p>
            Armin Dashti is a software engineer and vibe coder—a conductor of craft more than a
            solitary typist. As a vibe coder, he shapes intent with clarity and constraint, then
            lets Cursor’s agents compose the implementation; he reviews, refines, and ships what
            remains worthy.
          </p>
          <p>
            This application was not stitched by hurried hands alone. It was written by AI
            agents—specifically Cursor—guided by Armin’s intent, then tempered by his review until
            it was fit to ship.
          </p>
          <p>
            He builds practical API and WebUI products across modern stacks—especially Golang
            services, Vue-based front ends, and PostgreSQL. He favors clean architecture, lucid
            interfaces, and delivery one can trust. He prefers substance over spectacle: he watches
            carefully, plans deliberately, and ships when the work is ready.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-line/80 bg-paper/70 p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Interests
        </h2>
        <p className="text-sm leading-relaxed text-ink">
          Beyond the terminal, his curiosities roam widely: cars, movies, vibe coding, coding,
          politics, military, jet fighters, aircraft.
        </p>
      </section>

      <ContactEmail />

      <div className="space-y-3">
        <blockquote className="border-l-2 border-moss pl-4 text-sm italic leading-relaxed text-ink/90">
          &ldquo;Beware the quiet man. For while others speak, he watches. While others act, he
          plans. And when they finally rest, he strikes.&rdquo; — Anonymous
        </blockquote>
        <blockquote
          dir="rtl"
          lang="fa"
          className="border-r-2 border-moss pr-4 text-sm italic leading-relaxed text-ink/90"
        >
          «از مرد خاموش برحذر باش. زیرا در حالی که دیگران سخن می‌گویند، او نظاره می‌کند. در حالی که
          دیگران عمل می‌کنند، او برنامه می‌ریزد. و هنگامی که سرانجام آرام می‌گیرند، او ضربه
          می‌زند.» — ناشناس
        </blockquote>
      </div>
    </div>
  );
}
