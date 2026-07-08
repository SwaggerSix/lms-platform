import Link from "next/link";
import { ArrowRight, HelpCircle, Users, ExternalLink } from "lucide-react";
import { MarkdownLite } from "./markdown-lite";
import type { HelpChapter, HelpRole } from "@/content/help/types";
import { getManual } from "@/content/help";

function chapterHref(role: HelpRole, slug: string) {
  return `/help/${role}/${slug}`;
}

export function ChapterRenderer({
  role,
  chapter,
}: {
  role: HelpRole;
  chapter: HelpChapter;
}) {
  const manual = getManual(role);

  return (
    <article className="mx-auto max-w-3xl space-y-10 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <div className="text-xs font-medium uppercase tracking-wider text-primary-600">
          {manual.title}
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{chapter.title}</h1>
        <p className="text-base text-gray-600">{chapter.summary}</p>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          {chapter.whoItsFor && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">
              <Users className="h-3 w-3" />
              {chapter.whoItsFor}
            </span>
          )}
          {chapter.pageLink && (
            <Link
              href={chapter.pageLink}
              className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 font-medium text-primary-700 hover:bg-primary-100"
            >
              Open the page
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </header>

      {/* Body sections */}
      <div className="space-y-8">
        {chapter.sections.map((s, i) => (
          <section key={i} className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">{s.heading}</h2>
            <MarkdownLite source={s.body} />
          </section>
        ))}
      </div>

      {/* FAQs */}
      {chapter.faqs.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Frequently asked questions</h2>
          </div>
          <div className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
            {chapter.faqs.map((faq, i) => (
              <details key={i} className="group p-4 open:bg-gray-50">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-medium text-gray-900">
                  <span>{faq.q}</span>
                  <span className="mt-0.5 text-gray-400 transition-transform group-open:rotate-90">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </summary>
                <div className="mt-3">
                  <MarkdownLite source={faq.a} />
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Related */}
      {chapter.related && chapter.related.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Related</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {chapter.related.map((r, i) => {
              const href = r.chapter ? chapterHref(role, r.chapter) : r.href ?? "#";
              const external = !!r.href && !r.href.startsWith("/");
              return (
                <li key={i}>
                  {external ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:border-primary-300 hover:bg-primary-50"
                    >
                      {r.label}
                      <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                    </a>
                  ) : (
                    <Link
                      href={href}
                      className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:border-primary-300 hover:bg-primary-50"
                    >
                      {r.label}
                      <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Back link */}
      <div className="border-t border-gray-200 pt-6">
        <Link
          href={`/help/${role}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          ← Back to {manual.title}
        </Link>
      </div>
    </article>
  );
}

export default ChapterRenderer;
