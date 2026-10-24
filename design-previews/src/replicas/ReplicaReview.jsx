import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../components/primitives";
import "./replica-review.css";

const sources = [
  { id: "ciklum", slug: "signal", name: "Signal" },
  { id: "andela", slug: "human", name: "Human" },
  { id: "nityo", slug: "atlas", name: "Atlas" },
];
function locationState() {
  const q = new URLSearchParams(window.location.search),
    selected = q.get("design");
  return {
    design:
      selected === "enterprise"
        ? "nityo"
        : sources.find((s) => s.id === selected || s.slug === selected)?.id ||
          "ciklum",
    page: q.get("page") || "01-home",
    hash: window.location.hash,
    motionFlag: q.get("motion"),
  };
}
function normalizeManifest(raw, design) {
  const pages = (Array.isArray(raw) ? raw : raw.pages || []).map((p) => ({
    id: p.id,
    title: p.title || p.id,
    file: p.file || p.path || `/replicas/${design}/${p.id}.html`,
    sourceUrl: p.sourceUrl || p.source || "",
    initialHash: p.initialHash || "",
  }));
  return { ...raw, design, pages };
}
function ReplicaFrame({ src, frameRef, ...attributes }) {
  // Motion messages control the current document; section links retain its launch query.
  const [entrySource] = useState(src);
  const destination = new URL(entrySource, location.origin);
  destination.hash = new URL(src, location.origin).hash;
  return <iframe {...attributes} ref={frameRef} src={destination.href} />;
}
export function ReplicaReview() {
  const [route, setRoute] = useState(locationState),
    [manifests, setManifests] = useState({}),
    [status, setStatus] = useState("loading"),
    [loaded, setLoaded] = useState(false);
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [override, setOverride] = useState(() => {
    const v = new URLSearchParams(location.search).get("motion");
    return v === "on" ? true : v === "off" ? false : null;
  });
  const frame = useRef(null);
  const motion = override ?? !reduced,
    manifest = manifests[route.design],
    page =
      manifest?.pages.find((p) => p.id === route.page) ||
      manifest?.pages.find((p) => p.id === "17-404") ||
      manifest?.pages[0];
  const src = page ? new URL(page.file, location.origin) : null;
  if (src) {
    if (route.motionFlag) src.searchParams.set("motion", route.motionFlag);
    if (route.hash) src.hash = route.hash;
    else if (page.initialHash) src.hash = page.initialHash;
  }
  useEffect(() => {
    let active = true;
    Promise.allSettled(
      sources.map(async (s) => {
        const r = await fetch(`/replicas/${s.id}/manifest.json`, {
          cache: "no-store",
        });
        if (!r.ok) throw new Error(`${s.name} manifest ${r.status}`);
        return normalizeManifest(await r.json(), s.id);
      }),
    ).then((results) => {
      if (!active) return;
      const ready = {};
      results.forEach((r) => {
        if (r.status === "fulfilled") ready[r.value.design] = r.value;
      });
      setManifests(ready);
      setStatus(Object.keys(ready).length ? "ready" : "unavailable");
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const sync = () => {
      const destination = locationState();
      setLoaded(
        destination.design === route.design && destination.page === route.page,
      );
      setRoute(destination);
      const choice = new URLSearchParams(location.search).get("motion");
      setOverride(choice === "on" ? true : choice === "off" ? false : null);
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [route.design, route.page]);
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)"),
      sync = () => setReduced(m.matches);
    m.addEventListener("change", sync);
    return () => m.removeEventListener("change", sync);
  }, []);
  function changeMotion(enabled) {
    setOverride(enabled);
    const query = new URLSearchParams(location.search);
    query.set("motion", enabled ? "on" : "off");
    history.replaceState(
      history.state,
      "",
      `${location.pathname}?${query}${location.hash}`,
    );
  }
  function navigate(design, pageId, hash = "") {
    const available = manifests[design]?.pages;
    const chosen = available?.some((p) => p.id === pageId)
      ? pageId
      : available?.some((p) => p.id === "17-404")
        ? "17-404"
        : available?.[0]?.id || pageId;
    const q = new URLSearchParams({
      replica: "1",
      design: sources.find((s) => s.id === design)?.slug || design,
      page: chosen,
      motion: motion ? "on" : "off",
    });
    history.pushState({}, "", `?${q}${hash}`);
    setRoute({ design, page: chosen, hash, motionFlag: motion ? "on" : "off" });
    setLoaded(design === route.design && chosen === page?.id);
  }
  useEffect(() => {
    function receive(event) {
      if (
        event.origin !== location.origin ||
        event.source !== frame.current?.contentWindow
      )
        return;
      const data = event.data || {};
      if (data.type === "replica:navigate" && typeof data.pageId === "string")
        navigate(route.design, data.pageId, data.hash || "");
      if (data.type === "replica:ready") {
        setLoaded(true);
        frame.current?.contentWindow?.postMessage(
          { type: "replica:motion", enabled: motion },
          location.origin,
        );
      }
      if (
        data.type === "replica:requestMotion" &&
        typeof data.enabled === "boolean"
      )
        changeMotion(data.enabled);
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [route.design, route.page, motion, manifests]);
  useEffect(() => {
    frame.current?.contentWindow?.postMessage(
      { type: "replica:motion", enabled: motion },
      location.origin,
    );
  }, [motion]);
  useEffect(() => {
    document.title = `${page?.title || route.page} — Artechs USA | ${sources.find((s) => s.id === route.design)?.name} design · Client: Rahul`;
  }, [page?.title, route.design, route.page]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const slug = sources.find((s) => s.id === route.design)?.slug;
    if (slug && (params.get("design") !== slug || params.has("legacy"))) {
      params.set("design", slug);
      params.delete("legacy");
      history.replaceState(history.state, "", `${location.pathname}?${params}${location.hash}`);
    }
  }, [route.design]);
  return (
    <div className="reference-review">
      <div className="rr-bar">
        <div className="rr-brand">
          <strong>Client: Rahul</strong>
          <span>Artechs USA · Website designs</span>
        </div>
        <div className="rr-designs" aria-label="Design directions">
          {sources.map((s) => (
            <button
              key={s.id}
              aria-pressed={route.design === s.id}
              onClick={() => navigate(s.id, "01-home")}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="rr-controls">
          <label htmlFor="rr-page" className="sr-only">
            Website page
          </label>
          <select
            id="rr-page"
            value={page?.id || route.page}
            onChange={(e) => navigate(route.design, e.target.value)}
            disabled={!manifest}
          >
            {manifest?.pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            )) || (
              <option>
                {status === "loading" ? "Loading pages…" : "Not ready"}
              </option>
            )}
          </select>
          <button
            className="rr-tool"
            aria-label={motion ? "Pause motion" : "Enable motion"}
            onClick={() => changeMotion(!motion)}
          >
            <Icon name={motion ? "pause" : "play"} size={17} />
            <span>{motion ? "Pause" : "Play"}</span>
          </button>
        </div>
      </div>
      {src ? (
        <ReplicaFrame
          frameRef={frame}
          key={`${route.design}-${page.id}`}
          src={src.href}
          title={`Artechs USA ${sources.find((s) => s.id === route.design)?.name} ${page.title} design`}
          className="rr-frame"
          sandbox="allow-scripts allow-same-origin allow-forms"
          allow="autoplay"
          onLoad={() => {
            frame.current?.contentDocument
              ?.querySelectorAll("form")
              .forEach((form) => form.setAttribute("action", "about:blank"));
            setLoaded(true);
            frame.current?.contentWindow?.postMessage(
              { type: "replica:motion", enabled: motion },
              location.origin,
            );
          }}
        />
      ) : (
        <div className="rr-loading">
          <h1>
            {status === "loading"
              ? "Loading design…"
              : "This design is being prepared."}
          </h1>
          <p>Artechs USA pages and design assets are being assembled.</p>
        </div>
      )}
      {!loaded && src && (
        <div className="rr-load-status" role="status">
          Loading page…
        </div>
      )}
    </div>
  );
}
