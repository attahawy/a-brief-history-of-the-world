import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { renderPageMarkdown } from "./lib/markdown.js";
import { pagePath, pageIdFromUrl, updatePageMetadata, storageNamespace, siteName, authorName } from "./lib/site.js";
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
  return [value, setValue];
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
    check: <path d="m5 12 4 4L19 6" />,
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
          الصفحة السابقة، والسهم الأيسر للانتقال إلى الصفحة التالية.
        </p>
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
  const [finished, setFinished] = useStored("finished", []);
  const [fontSize, setFontSize] = useStored("font-size", 25);
  const [theme, setTheme] = useStored("theme", "paper");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const articleRef = useRef(null);
  const startAtTopRef = useRef(false);
  const page = pagesById.get(pageId);
  const readingTitle = page.readingTitle;
  const index = orderedPages.findIndex((item) => item.pageid === pageId);
  const isFinished = finished.includes(pageId);

  useEffect(() => {
    document.documentElement.dataset.theme =
      theme === "night" ? "night" : "paper";
  }, [theme]);
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
  }, [index, navigate, orderedPages, preferencesOpen]);

  const toggleFinished = () =>
    setFinished((previous) =>
      previous.includes(pageId)
        ? previous.filter((id) => id !== pageId)
        : [...previous, pageId],
    );
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
            <small>{authorName}</small>
          </span>
        </a>
        <span className="header-note">من القرآن العظيم والحديث الشريف</span>
        <div className="header-actions">
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
              الصفحة {number(index + 1)} <span>من {number(totalPages)}</span>
            </p>
            <h1>{readingTitle}</h1>
            <div className="chapter-meta">
              <span>{number(page.readingMinutes)} دقائق قراءة</span>
              <span className="meta-dot">·</span>
              <span>{number(page.wordCount)} كلمة</span>
            </div>
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
          {page.tags.length > 0 && (
            <div
              className="chapter-tags"
              role="group"
              aria-label="موضوعات الصفحة"
            >
              {page.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          )}
          <footer className="chapter-footer">
            <span className="end-mark">◆</span>
            <button
              className={`finished-button ${isFinished ? "is-finished" : ""}`}
              aria-pressed={isFinished}
              onClick={toggleFinished}
            >
              <Icon name="check" size={17} />
              {isFinished ? "تمّت قراءة هذه الصفحة" : "أتممتُ قراءة هذه الصفحة"}
            </button>
            <nav className="page-navigation" aria-label="التنقل بين الصفحات">
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
                  <small>الصفحة السابقة</small>
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
                  <small>الصفحة التالية</small>
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
