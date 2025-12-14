"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";

const storage = typeof window !== "undefined" ? window.localStorage : undefined;

type QuizOption = { id: string; text: string; correct?: boolean };
type QuizDraft = { title: string; question: string; options: QuizOption[]; cta: string; creativeId?: string };

type Slide = { id: string; title: string; image: string; ctaText?: string; ctaUrl?: string };
type CarouselDraft = { title: string; slides: Slide[]; creativeId?: string };

type AnalyticsRow = { format: string; type: string; count: number };
type InteractiveCreative = { id: string; type: "quiz" | "carousel"; name: string; payload?: unknown; updatedAt?: string };
type ShoppableItem = { id: string; name: string; price: number; image: string; url: string };
type ShoppableDraft = { headline: string; cta: string; items: ShoppableItem[] };
type CollectionDraft = { title: string; description?: string; items: ShoppableItem[] };
type CountdownDraft = { label: string; endsAt: string; warningSeconds: number };

function CountdownDisplay({ label, endsAt, warningSeconds }: CountdownDraft) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const target = useMemo(() => (endsAt ? new Date(endsAt).getTime() : new Date().getTime()), [endsAt]);
  const remaining = Math.max(0, target - now);
  const seconds = Math.floor(remaining / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const warning = seconds <= warningSeconds;
  return (
    <div className={`rounded-lg border ${warning ? "border-amber-400/60 bg-amber-500/10" : "border-white/10 bg-slate-800/70"} p-4 flex items-center justify-between`}>
      <div>
        <p className="text-sm text-slate-300">{label || "Countdown"}</p>
        <p className="text-xs text-slate-400">Ends: {endsAt || "n/a"}</p>
      </div>
      <div className="text-2xl font-semibold tabular-nums" aria-live="polite">
        {h.toString().padStart(2, "0")}:{m.toString().padStart(2, "0")}:{s.toString().padStart(2, "0")}
      </div>
    </div>
  );
}

const newId = () => Math.random().toString(36).slice(2, 9);

function useAutosave<T>(key: string, initial: T): [T, (next: T) => void, boolean] {
  const [state, setState] = useState<T>(() => {
    if (!storage) return initial;
    try {
      const saved = storage.getItem(key);
      return saved ? (JSON.parse(saved) as T) : initial;
    } catch {
      return initial;
    }
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!storage) return;
    storage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  const update = (next: T) => {
    setState(next);
    setDirty(true);
  };

  return [state, update, dirty];
}

async function trackEvent(
  format: "quiz" | "carousel",
  type: "impression" | "engagement" | "conversion" | "submit" | "view",
  payload: Record<string, unknown>
) {
  try {
    await fetch("/api/ads/interactive/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, type, payload }),
    });
  } catch (err) {
    console.error("trackEvent failed", err);
  }
}

export default function InteractiveAdsPage() {
  const [quiz, setQuiz, quizDirty] = useAutosave<QuizDraft>("interactive-quiz-draft", {
    title: "",
    question: "",
    options: [
      { id: newId(), text: "Option A" },
      { id: newId(), text: "Option B" },
    ],
    cta: "Submit",
  });

  const [carousel, setCarousel, carouselDirty] = useAutosave<CarouselDraft>("interactive-carousel-draft", {
    title: "",
    slides: [
      { id: newId(), title: "Slide 1", image: "", ctaText: "Learn more", ctaUrl: "" },
      { id: newId(), title: "Slide 2", image: "", ctaText: "See details", ctaUrl: "" },
    ],
  });

  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([]);
  const [creatives, setCreatives] = useState<InteractiveCreative[]>([]);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [savingCarousel, setSavingCarousel] = useState(false);
  const [loadingCreatives, setLoadingCreatives] = useState(false);
  const [creativeError, setCreativeError] = useState<string | null>(null);

  const [shoppable, setShoppable] = useState<ShoppableDraft>({
    headline: "Shoppable look",
    cta: "Add to bag",
    items: [
      { id: newId(), name: "Item A", price: 49, image: "", url: "" },
      { id: newId(), name: "Item B", price: 79, image: "", url: "" },
    ],
  });

  const [collection, setCollection] = useState<CollectionDraft>({
    title: "Holiday picks",
    description: "Curated set",
    items: [
      { id: newId(), name: "Look 1", price: 99, image: "", url: "" },
      { id: newId(), name: "Look 2", price: 129, image: "", url: "" },
    ],
  });

  const [countdown, setCountdown] = useState<CountdownDraft>({
    label: "Sale ends in",
    endsAt: new Date(Date.now() + 3600_000).toISOString().slice(0, 16),
    warningSeconds: 300,
  });

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch("/api/ads/interactive/analytics");
      if (!res.ok) throw new Error("analytics failed");
      const data = await res.json();
      setAnalytics(data.data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchCreatives = useCallback(async () => {
    setLoadingCreatives(true);
    setCreativeError(null);
    try {
      const res = await fetch("/api/ads/interactive/creatives");
      if (!res.ok) throw new Error("creatives failed");
      const data = await res.json();
      setCreatives(data.data || []);
    } catch (err) {
      console.error(err);
      setCreativeError("Could not load saved creatives. Retry below.");
    } finally {
      setLoadingCreatives(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    fetchCreatives();
  }, [fetchAnalytics, fetchCreatives]);

  useEffect(() => {
    trackEvent("quiz", "view", { source: "builder" });
    trackEvent("carousel", "view", { source: "builder" });
  }, []);

  const saveQuiz = async () => {
    setSavingQuiz(true);
    try {
      const res = await fetch("/api/ads/interactive/creatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "quiz", name: quiz.title || "Quiz draft", payload: quiz }),
      });
      if (!res.ok) throw new Error("save failed");
      const body = await res.json();
      const savedId = body.data?.id as string | undefined;
      setQuiz({ ...quiz, creativeId: savedId });
      fetchCreatives();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingQuiz(false);
    }
  };

  const saveCarousel = async () => {
    setSavingCarousel(true);
    try {
      const res = await fetch("/api/ads/interactive/creatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "carousel", name: carousel.title || "Carousel draft", payload: carousel }),
      });
      if (!res.ok) throw new Error("save failed");
      const body = await res.json();
      const savedId = body.data?.id as string | undefined;
      setCarousel({ ...carousel, creativeId: savedId });
      fetchCreatives();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingCarousel(false);
    }
  };

  const hydrateQuiz = (payload: unknown, creativeId?: string) => {
    if (!payload || typeof payload !== "object") return;
    const maybe = payload as Partial<QuizDraft>;
    if (!maybe.options || !Array.isArray(maybe.options)) return;
    setQuiz({
      title: maybe.title ?? "",
      question: maybe.question ?? "",
      options: maybe.options.map((opt, idx) => ({ id: opt.id ?? newId() + idx, text: opt.text ?? "", correct: opt.correct })),
      cta: maybe.cta ?? "Submit",
      creativeId,
    });
  };

  const hydrateCarousel = (payload: unknown, creativeId?: string) => {
    if (!payload || typeof payload !== "object") return;
    const maybe = payload as Partial<CarouselDraft>;
    if (!maybe.slides || !Array.isArray(maybe.slides)) return;
    setCarousel({
      title: maybe.title ?? "",
      slides: maybe.slides.map((s, idx) => ({
        id: s.id ?? newId() + idx,
        title: s.title ?? "",
        image: s.image ?? "",
        ctaText: s.ctaText,
        ctaUrl: s.ctaUrl,
      })),
      creativeId,
    });
  };

  const quizPreviewValid = useMemo(
    () => quiz.title.trim() && quiz.question.trim() && quiz.options.filter((o) => o.text.trim()).length >= 2,
    [quiz]
  );

  const [activeSlide, setActiveSlide] = useState(0);
  const slideCount = carousel.slides.length;
  const goTo = (idx: number) => {
    const next = (idx + slideCount) % slideCount;
    setActiveSlide(next);
    trackEvent("carousel", "engagement", { slide: next, title: carousel.slides[next]?.title });
  };

  const onQuizSubmit = () => {
    trackEvent("quiz", "submit", { quizTitle: quiz.title });
    trackEvent("quiz", "conversion", { quizTitle: quiz.title, optionCount: quiz.options.length });
    alert("Quiz submitted (demo)");
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-900/80 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-indigo-200 hover:text-white">Dashboard</Link>
          <span className="text-slate-600">/</span>
          <span className="font-semibold">Interactive Ads V1</span>
        </div>
        <div className="text-xs text-slate-400">Drafts autosave • Keyboard/ARIA ready</div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        <section className="grid gap-6 lg:grid-cols-2" aria-label="Quiz builder" role="region">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Quiz Builder</h2>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Autosaved {quizDirty ? "*" : ""}</span>
                <button className="btn-secondary" onClick={saveQuiz} disabled={savingQuiz} aria-label="Save quiz creative">
                  {savingQuiz ? "Saving..." : "Save to library"}
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <label className="block text-sm" aria-label="Quiz title">
                Title
                <input
                  className="input"
                  value={quiz.title}
                  onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                />
              </label>
              <label className="block text-sm" aria-label="Quiz question">
                Question
                <textarea
                  className="input"
                  value={quiz.question}
                  onChange={(e) => setQuiz({ ...quiz, question: e.target.value })}
                />
              </label>
              <div className="space-y-2" role="group" aria-label="Quiz options">
                {quiz.options.map((opt, idx) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input
                      className="input flex-1"
                      value={opt.text}
                      aria-label={`Option ${idx + 1}`}
                      onChange={(e) => {
                        const next = quiz.options.map((o) => (o.id === opt.id ? { ...o, text: e.target.value } : o));
                        setQuiz({ ...quiz, options: next });
                      }}
                    />
                    <label className="flex items-center gap-1 text-xs text-slate-300">
                      <input
                        type="radio"
                        name="correct"
                        aria-label="Mark correct"
                        checked={!!opt.correct}
                        onChange={() => {
                          const next = quiz.options.map((o) => ({ ...o, correct: o.id === opt.id }));
                          setQuiz({ ...quiz, options: next });
                        }}
                      />
                      Correct
                    </label>
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        const next = quiz.options.filter((o) => o.id !== opt.id);
                        setQuiz({ ...quiz, options: next.length ? next : quiz.options });
                      }}
                      aria-label={`Remove option ${idx + 1}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  className="btn"
                  onClick={() => setQuiz({ ...quiz, options: [...quiz.options, { id: newId(), text: "New option" }] })}
                  aria-label="Add option"
                >
                  + Add option
                </button>
              </div>
              <label className="block text-sm" aria-label="CTA label">
                CTA label
                <input
                  className="input"
                  value={quiz.cta}
                  onChange={(e) => setQuiz({ ...quiz, cta: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-400/30 bg-slate-900/60 p-5 shadow-xl" role="region" aria-label="Quiz preview">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-emerald-200">Preview</h2>
              {!quizPreviewValid && <span className="text-xs text-amber-300">Need title, question, 2 options</span>}
            </div>
            <div className="space-y-3">
              <p className="text-sm text-slate-300" role="heading" aria-level={3}>{quiz.title || "Untitled quiz"}</p>
              <p className="text-base">{quiz.question || "Add your question"}</p>
              <div role="radiogroup" aria-label="Quiz options" className="space-y-2">
                {quiz.options.map((opt, idx) => (
                  <label key={opt.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="preview-options"
                      aria-label={`Option ${idx + 1}`}
                      onChange={() => trackEvent("quiz", "engagement", { optionIndex: idx, quizTitle: quiz.title })}
                    />
                    <span>{opt.text}</span>
                  </label>
                ))}
              </div>
              <button
                className="btn"
                disabled={!quizPreviewValid}
                onClick={onQuizSubmit}
                aria-label="Submit quiz preview"
              >
                {quiz.cta || "Submit"}
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2" aria-label="Carousel builder" role="region">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Carousel Builder</h2>
              <span className="text-xs text-slate-400">Autosaved {carouselDirty ? "*" : ""}</span>
            </div>
            <label className="block text-sm" aria-label="Carousel title">
              Title
              <input
                className="input"
                value={carousel.title}
                onChange={(e) => setCarousel({ ...carousel, title: e.target.value })}
              />
            </label>
            <div className="space-y-3 mt-3" role="group" aria-label="Slides list">
              {carousel.slides.map((slide, idx) => (
                <div key={slide.id} className="rounded-lg border border-white/10 p-3 space-y-2" aria-label={`Slide ${idx + 1}`}>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Slide {idx + 1}</span>
                    <button
                      className="btn-secondary"
                      aria-label={`Remove slide ${idx + 1}`}
                      onClick={() => setCarousel({ ...carousel, slides: carousel.slides.filter((s) => s.id !== slide.id) })}
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    className="input"
                    placeholder="Title"
                    value={slide.title}
                    onChange={(e) => {
                      const next = carousel.slides.map((s) => (s.id === slide.id ? { ...s, title: e.target.value } : s));
                      setCarousel({ ...carousel, slides: next });
                    }}
                    aria-label={`Slide ${idx + 1} title`}
                  />
                  <input
                    className="input"
                    placeholder="Image URL"
                    value={slide.image}
                    onChange={(e) => {
                      const next = carousel.slides.map((s) => (s.id === slide.id ? { ...s, image: e.target.value } : s));
                      setCarousel({ ...carousel, slides: next });
                    }}
                    aria-label={`Slide ${idx + 1} image URL`}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="input"
                      placeholder="CTA text"
                      value={slide.ctaText ?? ""}
                      onChange={(e) => {
                        const next = carousel.slides.map((s) => (s.id === slide.id ? { ...s, ctaText: e.target.value } : s));
                        setCarousel({ ...carousel, slides: next });
                      }}
                      aria-label={`Slide ${idx + 1} CTA text`}
                    />
                    <input
                      className="input"
                      placeholder="CTA URL"
                      value={slide.ctaUrl ?? ""}
                      onChange={(e) => {
                        const next = carousel.slides.map((s) => (s.id === slide.id ? { ...s, ctaUrl: e.target.value } : s));
                        setCarousel({ ...carousel, slides: next });
                      }}
                      aria-label={`Slide ${idx + 1} CTA URL`}
                    />
                  </div>
                </div>
              ))}
              <button className="btn" onClick={() => setCarousel({ ...carousel, slides: [...carousel.slides, { id: newId(), title: `Slide ${carousel.slides.length + 1}`, image: "" }] })} aria-label="Add slide">+ Add slide</button>
            </div>
            <div className="flex justify-end mt-3">
              <button className="btn-secondary" onClick={saveCarousel} disabled={savingCarousel} aria-label="Save carousel creative">
                {savingCarousel ? "Saving..." : "Save to library"}
              </button>
            </div>
          </div>

          <div
            className="rounded-2xl border border-indigo-400/30 bg-slate-900/60 p-5 shadow-xl space-y-3"
            role="region"
            aria-label="Carousel preview"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-indigo-200">Preview</h2>
              <div className="text-xs text-slate-400">Arrow keys navigate</div>
            </div>
            <div
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") goTo(activeSlide + 1);
                if (e.key === "ArrowLeft") goTo(activeSlide - 1);
              }}
              className="rounded-xl border border-white/10 bg-slate-800/80 p-4 outline-none focus:ring-2 focus:ring-indigo-400"
              aria-roledescription="carousel"
              aria-label={carousel.title || "Carousel"}
            >
              {carousel.slides.length > 0 && (
                <div className="space-y-2" aria-live="polite">
                  <div className="text-sm text-slate-400">Slide {activeSlide + 1} of {carousel.slides.length}</div>
                  <p className="text-base font-semibold">{carousel.slides[activeSlide]?.title || "Untitled"}</p>
                  {carousel.slides[activeSlide]?.image && (
                    <Image
                      src={carousel.slides[activeSlide]?.image}
                      alt={carousel.slides[activeSlide]?.title || "Carousel image"}
                      width={960}
                      height={420}
                      className="w-full h-48 object-cover rounded-lg"
                      unoptimized
                    />
                  )}
                  {carousel.slides[activeSlide]?.ctaText && (
                    <a
                      className="btn"
                      href={carousel.slides[activeSlide]?.ctaUrl || "#"}
                      onClick={() => trackEvent("carousel", "conversion", { slide: activeSlide, title: carousel.slides[activeSlide]?.title })}
                    >
                      {carousel.slides[activeSlide]?.ctaText}
                    </a>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 mt-3" role="group" aria-label="Carousel controls">
                <button className="btn-secondary" onClick={() => goTo(activeSlide - 1)} aria-label="Previous slide">◀</button>
                <button className="btn-secondary" onClick={() => goTo(activeSlide + 1)} aria-label="Next slide">▶</button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl" role="region" aria-label="Analytics">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Format Analytics</h2>
            <button className="btn-secondary" onClick={fetchAnalytics} aria-label="Refresh analytics">Refresh</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analytics.map((row) => (
              <div key={`${row.format}-${row.type}`} className="rounded-lg border border-white/10 bg-slate-800/80 p-3" role="article">
                <div className="text-sm text-slate-400">{row.format}</div>
                <div className="text-base font-semibold">{row.type}</div>
                <div className="text-xl">{row.count}</div>
              </div>
            ))}
            {analytics.length === 0 && <p className="text-slate-400 text-sm">No analytics yet</p>}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2" role="region" aria-label="Shoppable overlay">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Shoppable Overlay</h2>
              <span className="text-xs text-slate-400">Guard rails: 2-6 items</span>
            </div>
            <div className="space-y-3">
              <label className="block text-sm">
                Headline
                <input className="input" value={shoppable.headline} onChange={(e) => setShoppable({ ...shoppable, headline: e.target.value })} />
              </label>
              <label className="block text-sm">
                CTA
                <input className="input" value={shoppable.cta} onChange={(e) => setShoppable({ ...shoppable, cta: e.target.value })} />
              </label>
              <div className="space-y-2" aria-label="Shoppable items" role="group">
                {shoppable.items.map((item, idx) => (
                  <div key={item.id} className="rounded-lg border border-white/10 p-3 grid grid-cols-2 gap-2" aria-label={`Item ${idx + 1}`}>
                    <input className="input" placeholder="Name" value={item.name} onChange={(e) => {
                      const items = shoppable.items.map((it) => (it.id === item.id ? { ...it, name: e.target.value } : it));
                      setShoppable({ ...shoppable, items });
                    }} />
                    <input className="input" type="number" min={0} placeholder="Price" value={item.price}
                      onChange={(e) => {
                        const items = shoppable.items.map((it) => (it.id === item.id ? { ...it, price: Number(e.target.value) } : it));
                        setShoppable({ ...shoppable, items });
                      }} />
                    <input className="input" placeholder="Image URL" value={item.image} onChange={(e) => {
                      const items = shoppable.items.map((it) => (it.id === item.id ? { ...it, image: e.target.value } : it));
                      setShoppable({ ...shoppable, items });
                    }} />
                    <input className="input" placeholder="Product URL" value={item.url} onChange={(e) => {
                      const items = shoppable.items.map((it) => (it.id === item.id ? { ...it, url: e.target.value } : it));
                      setShoppable({ ...shoppable, items });
                    }} />
                    <div className="col-span-2 flex justify-between text-xs text-slate-400">
                      <span>{item.url ? "Link set" : "Missing link"}</span>
                      <button className="btn-secondary" onClick={() => setShoppable({ ...shoppable, items: shoppable.items.filter((it) => it.id !== item.id) })} aria-label={`Remove item ${idx + 1}`}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                <button className="btn" disabled={shoppable.items.length >= 6} onClick={() => setShoppable({ ...shoppable, items: [...shoppable.items, { id: newId(), name: "New Item", price: 0, image: "", url: "" }] })}>
                  + Add item
                </button>
                {shoppable.items.length < 2 && <p className="text-amber-300 text-xs">Need at least 2 items.</p>}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-400/30 bg-slate-900/60 p-5 shadow-xl space-y-3" aria-label="Shoppable preview">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-emerald-200">Overlay Preview</h2>
              <span className="text-xs text-slate-400">Perf: prefer images &lt;300KB</span>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-800/70 p-4">
              <div className="absolute top-3 right-3 bg-black/50 text-xs px-2 py-1 rounded-md">Shoppable</div>
              <p className="text-base font-semibold mb-2">{shoppable.headline || "Add a headline"}</p>
              <div className="grid grid-cols-2 gap-3">
                {shoppable.items.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-lg border border-white/10 bg-slate-900/60 p-3 space-y-1">
                    <div className="h-20 rounded-md bg-slate-700/70 flex items-center justify-center text-xs text-slate-300">
                      {item.image ? <Image src={item.image} alt={item.name} width={160} height={120} className="w-full h-full object-cover rounded-md" unoptimized /> : "Image"}
                    </div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-slate-300">${item.price?.toFixed(2)}</p>
                    <button className="btn" aria-label={`Shop ${item.name}`} onClick={() => trackEvent("quiz", "engagement", { item: item.name, price: item.price })}>
                      {shoppable.cta || "Shop"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2" role="region" aria-label="Collection page">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Collection Page</h2>
              <span className="text-xs text-slate-400">Requires 2+ items</span>
            </div>
            <label className="block text-sm">
              Title
              <input className="input" value={collection.title} onChange={(e) => setCollection({ ...collection, title: e.target.value })} />
            </label>
            <label className="block text-sm mt-2">
              Description
              <textarea className="input" value={collection.description ?? ""} onChange={(e) => setCollection({ ...collection, description: e.target.value })} />
            </label>
            <div className="space-y-2 mt-3">
              {collection.items.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-3 gap-2 rounded-lg border border-white/10 p-3" aria-label={`Collection item ${idx + 1}`}>
                  <input className="input" placeholder="Name" value={item.name} onChange={(e) => {
                    const items = collection.items.map((it) => (it.id === item.id ? { ...it, name: e.target.value } : it));
                    setCollection({ ...collection, items });
                  }} />
                  <input className="input" type="number" placeholder="Price" value={item.price} onChange={(e) => {
                    const items = collection.items.map((it) => (it.id === item.id ? { ...it, price: Number(e.target.value) } : it));
                    setCollection({ ...collection, items });
                  }} />
                  <input className="input" placeholder="Image URL" value={item.image} onChange={(e) => {
                    const items = collection.items.map((it) => (it.id === item.id ? { ...it, image: e.target.value } : it));
                    setCollection({ ...collection, items });
                  }} />
                  <input className="input col-span-2" placeholder="Destination URL" value={item.url} onChange={(e) => {
                    const items = collection.items.map((it) => (it.id === item.id ? { ...it, url: e.target.value } : it));
                    setCollection({ ...collection, items });
                  }} />
                  <button className="btn-secondary" onClick={() => setCollection({ ...collection, items: collection.items.filter((it) => it.id !== item.id) })}>Remove</button>
                </div>
              ))}
              <button className="btn" onClick={() => setCollection({ ...collection, items: [...collection.items, { id: newId(), name: "New", price: 0, image: "", url: "" }] })}>+ Add item</button>
              {collection.items.length < 2 && <p className="text-amber-300 text-xs">Need at least 2 items.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-400/30 bg-slate-900/60 p-5 shadow-xl space-y-3" aria-label="Collection preview">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-indigo-200">Collection Preview</h2>
              <span className="text-xs text-slate-400">Grid optimized</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-800/80 p-4">
              <p className="text-base font-semibold">{collection.title || "Collection"}</p>
              <p className="text-sm text-slate-300 mb-3">{collection.description || "Add description"}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {collection.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-white/10 bg-slate-900/50 p-3 space-y-1">
                    <div className="h-20 rounded-md bg-slate-700/70 flex items-center justify-center text-xs text-slate-300">
                      {item.image ? <Image src={item.image} alt={item.name} width={140} height={110} className="w-full h-full object-cover rounded-md" unoptimized /> : "Image"}
                    </div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-slate-300">${item.price?.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2" role="region" aria-label="Countdown timer">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Countdown Timer</h2>
              <span className="text-xs text-slate-400">Warn &lt;= {countdown.warningSeconds}s</span>
            </div>
            <label className="block text-sm">
              Label
              <input className="input" value={countdown.label} onChange={(e) => setCountdown({ ...countdown, label: e.target.value })} />
            </label>
            <label className="block text-sm">
              Ends at
              <input className="input" type="datetime-local" value={countdown.endsAt} onChange={(e) => setCountdown({ ...countdown, endsAt: e.target.value })} />
            </label>
            <label className="block text-sm">
              Warning seconds
              <input className="input" type="number" min={30} max={7200} value={countdown.warningSeconds} onChange={(e) => setCountdown({ ...countdown, warningSeconds: Number(e.target.value) })} />
            </label>
          </div>

          <div className="rounded-2xl border border-amber-400/30 bg-slate-900/60 p-5 shadow-xl space-y-2" aria-label="Countdown preview">
            <h2 className="text-lg font-semibold text-amber-200">Countdown Preview</h2>
            <CountdownDisplay label={countdown.label} endsAt={countdown.endsAt} warningSeconds={countdown.warningSeconds} />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl" role="region" aria-label="Saved creatives">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Saved creatives</h2>
            <button className="btn-secondary" onClick={fetchCreatives} disabled={loadingCreatives} aria-label="Refresh creatives">
              {loadingCreatives ? "Loading..." : "Refresh"}
            </button>
          </div>
          {creativeError && <p className="text-amber-300 text-sm mb-2">{creativeError}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {creatives.map((c) => (
              <div key={c.id} className="rounded-lg border border-white/10 bg-slate-800/80 p-3 space-y-2">
                <div className="text-sm text-slate-400">{c.type}</div>
                <div className="text-base font-semibold">{c.name}</div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Updated {c.updatedAt ? new Date(c.updatedAt).toLocaleString() : ""}</span>
                </div>
                <div className="flex gap-2">
                  {c.type === "quiz" && (
                    <button className="btn-secondary" onClick={() => hydrateQuiz(c.payload, c.id)} aria-label="Load quiz creative">Load quiz</button>
                  )}
                  {c.type === "carousel" && (
                    <button className="btn-secondary" onClick={() => hydrateCarousel(c.payload, c.id)} aria-label="Load carousel creative">Load carousel</button>
                  )}
                </div>
              </div>
            ))}
            {creatives.length === 0 && <p className="text-slate-400 text-sm">No saved creatives yet</p>}
          </div>
        </section>
      </div>

      <style jsx>{`
        .input { width: 100%; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.06); padding: 10px; color: #e2e8f0; }
        .btn { background: linear-gradient(120deg,#6366f1,#22d3ee); color: #0b1221; padding: 10px 14px; border-radius: 10px; font-weight: 600; border: none; cursor: pointer; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary { background: rgba(255,255,255,0.08); color: #e2e8f0; padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; }
      `}</style>
    </main>
  );
}
