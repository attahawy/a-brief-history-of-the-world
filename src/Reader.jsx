import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { renderPageMarkdown } from "./lib/markdown.js";
import { createChapterSearchIndex, searchChapters, searchTerms, searchExcerpt, findMatchRanges } from "./lib/search.js";
import { pagePath, pageIdFromUrl, updatePageMetadata, storageNamespace, siteName } from "./lib/site.js";
const numberFormatter = new Intl.NumberFormat("ar-EG", {
  numberingSystem: "latn",
});
const number = (value) => numberFormatter.format(value);
function readStored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(`${storageNamespace}:${key}`)) ?? fallback;
  } catch {
    return fallback;
  }
}

function useStored(key, fallback) {
  const [value, setValue] = useState(fallback);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setValue(readStored(key, fallback));
    setLoaded(true);
  }, [key]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(`${storageNamespace}:${key}`, JSON.stringify(value));
    } catch {
      /* Reading remains available when storage is disabled. */
    }
  }, [key, value, loaded]);
  return [value, setValue, loaded];
}

function Icon({ name, size = 20, ...props }) {
  const paths = {
    book: (
      <>
        <path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z" />
        <path d="M12 5v15" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    contents: (
      <>
        <path d="M9 6h12M9 12h12M9 18h12" />
        <path d="M3 6h1M3 12h1M3 18h1" />
      </>
    ),
    moon: <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="m9.5 3-.6 2.3-1.6.9L5 5.6 2.5 10l1.7 1.7v1L2.5 14.4 5 18.7l2.3-.6 1.6.9.6 2.3h5l.6-2.3 1.6-.9 2.3.6 2.5-4.3-1.7-1.7v-1L21.5 10 19 5.6l-2.3.6-1.6-.9-.6-2.3h-5Z" />
      </>
    ),
    right: <path d="m9 5 7 7-7 7" />,
    left: <path d="m15 5-7 7 7 7" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

export function ErrorMessage({ children, retry }) {
  return (
    <div className="empty-state" role="alert">
      <Icon name="book" size={36} />
      <h2>تعذّر فتح الكتاب</h2>
      <p>{children}</p>
      <button className="primary-button" onClick={retry}>
        حاول مرة أخرى
      </button>
    </div>
  );
}

function PreferencesDialog({
  open,
  onClose,
  theme,
  setTheme,
  fontSize,
  setFontSize,
}) {
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      id="reader-preferences"
      className="preferences-dialog"
      aria-labelledby="preferences-title"
      aria-describedby="preferences-help"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current.close();
      }}
    >
      <div className="preferences-panel">
        <div className="preferences-heading">
          <h2 id="preferences-title">إعدادات القراءة</h2>
          <button
            className="icon-button close-preferences"
            aria-label="إغلاق الإعدادات"
            onClick={() => dialogRef.current.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="preference-row">
          <span id="theme-label">المظهر</span>
          <div
            className="preference-options"
            role="group"
            aria-labelledby="theme-label"
          >
            <button
              aria-label="تفعيل الوضع النهاري"
              title="الوضع النهاري"
              aria-pressed={theme === "paper"}
              onClick={() => setTheme("paper")}
            >
              <Icon name="sun" />
            </button>
            <button
              aria-label="تفعيل الوضع الليلي"
              title="الوضع الليلي"
              aria-pressed={theme === "night"}
              onClick={() => setTheme("night")}
            >
              <Icon name="moon" />
            </button>
          </div>
        </div>
        <div className="preference-row">
          <span id="font-size-label">حجم النص</span>
          <div
            className="preference-options font-size-controls"
            role="group"
            aria-labelledby="font-size-label"
          >
            <button
              aria-label="تصغير النص"
              disabled={fontSize <= 20}
              onClick={() => setFontSize((size) => Math.max(20, size - 2))}
            >
              −
            </button>
            <output aria-label="حجم النص الحالي" aria-live="polite">
              {number(fontSize)}
            </output>
            <button
              aria-label="تكبير النص"
              disabled={fontSize >= 35}
              onClick={() => setFontSize((size) => Math.min(35, size + 2))}
            >
              +
            </button>
          </div>
        </div>
        <p id="preferences-help" className="preferences-help">
          أثناء القراءة، استخدم السهم الأيمن في لوحة المفاتيح للانتقال إلى
          الفصل السابق، والسهم الأيسر للانتقال إلى الفصل التالي.
        </p>
      </div>
    </dialog>
  );
}

function HighlightedText({ text, terms }) {
  const ranges = findMatchRanges(text, terms);
  const parts = [];
  let offset = 0;
  for (const [start, end] of ranges) {
    parts.push(text.slice(offset, start));
    parts.push(<mark key={start}>{text.slice(start, end)}</mark>);
    offset = end;
  }
  parts.push(text.slice(offset));
  return <>{parts}</>;
}

function BookNavigationDialog({ mode, onClose, pages, pageId, basePath, onNavigate }) {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const searching = mode === "search";
  const terms = useMemo(() => searchTerms(deferredQuery), [deferredQuery]);
  const entries = useMemo(
    () => pages.map((page, index) => ({ page, number: index + 1 })),
    [pages],
  );
  const searchIndex = useMemo(
    () => searching ? createChapterSearchIndex(pages) : [],
    [searching, pages],
  );
  const results = useMemo(
    () => searching ? searchChapters(searchIndex, deferredQuery) : entries,
    [searching, searchIndex, deferredQuery, entries],
  );

  useEffect(() => {
    if (!mode) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    if (mode === "search") {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      const current = dialog.querySelector('[aria-current="page"]');
      current?.focus({ preventScroll: true });
      current?.scrollIntoView({ block: "center" });
    }
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [mode]);

  return (
    <dialog
      ref={dialogRef}
      id="reader-navigation"
      className="navigation-dialog"
      aria-labelledby="navigation-title"
      aria-describedby="navigation-status"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current.close();
      }}
    >
      <div className="navigation-panel">
        <div className="navigation-heading">
          <h2 id="navigation-title">{searching ? "البحث في الكتاب" : "فهرس الكتاب"}</h2>
          <button
            type="button"
            className="icon-button close-preferences"
            aria-label={searching ? "إغلاق البحث" : "إغلاق الفهرس"}
            onClick={() => dialogRef.current.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        {searching && (
          <label className="book-search-field">
            <span className="search-label">ابحث في عناوين الفصول ونصوصها</span>
            <span className="book-search-input">
              <Icon name="search" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="اكتب كلمة أو أكثر…"
                autoComplete="off"
                spellCheck={false}
                maxLength={200}
                aria-controls="navigation-results"
              />
            </span>
          </label>
        )}
        <p id="navigation-status" className="navigation-status" role="status" aria-live="polite" aria-atomic="true">
          {searching
            ? terms.length
              ? results.length
                ? "نتائج في " + number(results.length) + " من الفصول"
                : "لم نعثر على نتائج. جرّب كلمات أخرى."
              : "ابحث بكلمة أو أكثر، مع التشكيل أو بدونه."
            : number(pages.length) + " فصلًا — اختر فصلًا للانتقال إليه"}
        </p>
        <ol
          id="navigation-results"
          className="navigation-results"
          aria-label={searching ? "نتائج البحث" : "فصول الكتاب"}
          aria-busy={searching && query !== deferredQuery}
        >
          {results.map(({ page, number: chapterNumber }) => (
            <li key={page.pageid}>
              <a
                href={pagePath(page.pageid, basePath)}
                aria-current={page.pageid === pageId ? "page" : undefined}
                onClick={(event) => {
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  dialogRef.current.close();
                  onNavigate(page.pageid);
                }}
              >
                <span className="contents-number" aria-label={"الفصل " + number(chapterNumber)}>{number(chapterNumber)}</span>
                <span className="navigation-result-copy">
                  <strong><HighlightedText text={page.readingTitle} terms={searching ? terms : []} /></strong>
                  {searching && (
                    <span className="search-excerpt"><HighlightedText text={searchExcerpt(page.text, terms)} terms={terms} /></span>
                  )}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </dialog>
  );
}

export default function Reader({ book, initialPageId, basePath = "/" }) {
  const orderedPages = book.pages;
  const totalPages = orderedPages.length;
  const firstPageId = orderedPages[0].pageid;
  const pagesById = useMemo(
    () => new Map(orderedPages.map((page) => [page.pageid, page])),
    [orderedPages],
  );
  const [pageId, setPageId] = useState(initialPageId ?? firstPageId);
  const [fontSize, setFontSize] = useStored("font-size", 25);
  const [theme, setTheme, themeLoaded] = useStored("theme", "paper");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [navigationMode, setNavigationMode] = useState(null);
  const [progress, setProgress] = useState(0);
  const articleRef = useRef(null);
  const startAtTopRef = useRef(false);
  const page = pagesById.get(pageId);
  const readingTitle = page.readingTitle;
  const index = orderedPages.findIndex((item) => item.pageid === pageId);

  useEffect(() => {
    if (!themeLoaded) return;
    document.documentElement.dataset.theme =
      theme === "night" ? "night" : "paper";
    document.querySelector('meta[name="theme-color"]').content =
      theme === "night" ? "#1c2522" : "#f9f7f2";
  }, [theme, themeLoaded]);
  useEffect(() => {
    try {
      localStorage.setItem(`${storageNamespace}:last-page`, JSON.stringify(pageId));
    } catch {}
    updatePageMetadata(page);
  }, [pageId, page]);
  useEffect(() => {
    const onPopState = () => {
      startAtTopRef.current = false;
      const requested = pageIdFromUrl(location.href, basePath);
      if (pagesById.has(requested)) setPageId(requested);
      else setPageId(firstPageId);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [pagesById, firstPageId, basePath]);

  useLayoutEffect(() => {
    const startAtTop = startAtTopRef.current;
    startAtTopRef.current = false;
    const position = startAtTop
      ? 0
      : Number(readStored(`position:${pageId}`, 0)) || 0;
    const restoreScroll = () => {
      let anchor;
      try {
        anchor = decodeURIComponent(location.hash.slice(1));
      } catch {
        anchor = "";
      }
      if (anchor && document.getElementById(anchor))
        document.getElementById(anchor).scrollIntoView();
      else window.scrollTo(0, position);
    };
    // Direct navigation starts fresh; reloads and history resume reading.
    if (startAtTop) restoreScroll();
    const frame = requestAnimationFrame(restoreScroll);
    let timer;
    const onScroll = () => {
      const article = articleRef.current;
      if (!article) return;
      const available = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      setProgress(
        Math.min(100, Math.max(0, (window.scrollY / available) * 100)),
      );
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          localStorage.setItem(
            `${storageNamespace}:position:${pageId}`,
            JSON.stringify(window.scrollY),
          );
        } catch {
          /* Optional persistence. */
        }
      }, 120);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [page, pageId]);

  const navigate = useCallback(
    (id, anchor = "") => {
      if (!pagesById.has(id)) return;
      if (id === pageId) {
        history.pushState(null, "", `${pagePath(id, basePath)}${anchor}`);
        let decoded;
        try {
          decoded = decodeURIComponent(anchor.slice(1));
        } catch {
          decoded = "";
        }
        if (decoded) document.getElementById(decoded)?.scrollIntoView();
        else window.scrollTo(0, 0);
      } else {
        history.pushState(null, "", `${pagePath(id, basePath)}${anchor}`);
        startAtTopRef.current = true;
        setPageId(id);
        setProgress(0);
      }
      document.getElementById("reading")?.focus({ preventScroll: true });
    },
    [pagesById, pageId, basePath],
  );

  const followPage = (event, id) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    if (id) navigate(id);
  };

  useEffect(() => {
    const keydown = (event) => {
      if (
        preferencesOpen ||
        navigationMode ||
        !["ArrowRight", "ArrowLeft"].includes(event.key) ||
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) ||
        event.target.isContentEditable
      )
        return;
      const destination =
        orderedPages[index + (event.key === "ArrowLeft" ? 1 : -1)];
      if (!destination) return;
      event.preventDefault();
      navigate(destination.pageid);
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [index, navigate, orderedPages, preferencesOpen, navigationMode]);

  const html = useMemo(
    () => renderPageMarkdown(page, orderedPages, basePath),
    [page, orderedPages, basePath],
  );

  return (
    <>
      <a href="#reading" className="skip-link">
        انتقل إلى القراءة
      </a>
      <header className="site-header">
        <a
          className="brand"
          href={pagePath(firstPageId, basePath)}
          onClick={(event) => {
            followPage(event, firstPageId);
          }}
          aria-label={`${siteName}، بداية الكتاب`}
        >
          <span>
            <strong>{siteName}</strong>
            <small>من القرآن العظيم والحديث الشريف</small>
          </span>
        </a>
        <div className="header-actions">
          <button
            type="button"
            className="navigation-button"
            onClick={() => setNavigationMode("search")}
            aria-label="البحث في الكتاب"
            title="البحث"
            aria-haspopup="dialog"
            aria-controls="reader-navigation"
            aria-expanded={navigationMode === "search"}
          >
            <Icon name="search" />
          </button>
          <button
            type="button"
            className="navigation-button"
            onClick={() => setNavigationMode("contents")}
            aria-label="فهرس الكتاب"
            title="الفهرس"
            aria-haspopup="dialog"
            aria-controls="reader-navigation"
            aria-expanded={navigationMode === "contents"}
          >
            <Icon name="contents" />
          </button>
          <button
            className="settings-button"
            onClick={() => setPreferencesOpen(true)}
            aria-label="إعدادات القراءة"
            aria-haspopup="dialog"
            aria-controls="reader-preferences"
          >
            <Icon name="settings" />
          </button>
        </div>
      </header>

      <main className="reader-main" id="reading" tabIndex={-1}>
        <div className="book-page" key={pageId}>
          <div className="chapter-heading">
            <p className="chapter-kicker">
              الفصل {number(index + 1)} <span>من {number(totalPages)}</span>
            </p>
            <h1>{readingTitle}</h1>
          </div>
          <div className="title-ornament">
            <span />
            <i>❧</i>
            <span />
          </div>
          <article
            ref={articleRef}
            className="book-content"
            style={{
              "--reading-size": `${Math.min(35, Math.max(20, Number(fontSize) || 25))}px`,
            }}
            onClick={(event) => {
              const link = event.target.closest("a[data-page-id]");
              if (
                link &&
                event.button === 0 &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey
              ) {
                event.preventDefault();
                navigate(Number(link.dataset.pageId), new URL(link.href).hash);
              }
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <footer className="chapter-footer">
            <span className="end-mark">◆</span>
            <nav className="page-navigation" aria-label="التنقل بين الفصول">
              <a
                href={
                  index
                    ? pagePath(orderedPages[index - 1].pageid, basePath)
                    : undefined
                }
                aria-disabled={index === 0}
                tabIndex={index === 0 ? -1 : undefined}
                aria-keyshortcuts="ArrowRight"
                onClick={(event) =>
                  followPage(event, orderedPages[index - 1]?.pageid)
                }
              >
                <Icon name="right" size={20} />
                <span>
                  <small>الفصل السابق</small>
                  <strong>
                    {index
                      ? orderedPages[index - 1].readingTitle
                      : "بداية الكتاب"}
                  </strong>
                </span>
              </a>
              <a
                className="next-page"
                aria-keyshortcuts="ArrowLeft"
                href={
                  orderedPages[index + 1]
                    ? pagePath(orderedPages[index + 1].pageid, basePath)
                    : undefined
                }
                aria-disabled={index === orderedPages.length - 1}
                tabIndex={index === orderedPages.length - 1 ? -1 : undefined}
                onClick={(event) =>
                  followPage(event, orderedPages[index + 1]?.pageid)
                }
              >
                <span>
                  <small>الفصل التالي</small>
                  <strong>
                    {orderedPages[index + 1]?.readingTitle ?? "نهاية الكتاب"}
                  </strong>
                </span>
                <Icon name="left" size={20} />
              </a>
            </nav>
          </footer>
        </div>
      </main>
      <BookNavigationDialog
        mode={navigationMode}
        onClose={() => setNavigationMode(null)}
        pages={orderedPages}
        pageId={pageId}
        basePath={basePath}
        onNavigate={navigate}
      />
      <PreferencesDialog
        open={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
        theme={theme}
        setTheme={setTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
      />
      <div
        className="scroll-progress"
        style={{ width: `${progress}%` }}
        aria-hidden="true"
      />
    </>
  );
}
