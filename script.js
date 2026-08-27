(() => {
  const FRAME_COUNT = 70;
  const EASE = 0.1;
  const frameSrc = (n) => `hero_webp/hero-frame-${String(n).padStart(4, "0")}.webp`;

  const start = () => {
    const root = document.documentElement;
    const header = document.querySelector(".site-header");
    const pin = document.querySelector(".hero-pin");
    const overlay = document.querySelector(".site-overlay");
    const hero = document.querySelector(".hero");
    const canvas = document.querySelector(".hero-canvas");
    const revealItems = Array.from(document.querySelectorAll("[data-reveal]"));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const updateHeader = () => {
      if (!header) return;
      const overlayTop = overlay ? overlay.getBoundingClientRect().top : Infinity;
      header.classList.toggle("is-scrolled", overlayTop <= 72);
    };

    const toggle = document.querySelector(".nav-toggle");
    const nav = document.querySelector("#primary-nav");
    const setMenu = (open) => {
      if (!header || !toggle) return;
      header.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };

    if (toggle && nav && header) {
      toggle.addEventListener("click", () => {
        setMenu(!header.classList.contains("is-open"));
      });
      nav.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => setMenu(false));
      });
      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape") setMenu(false);
      });
      window.addEventListener("resize", () => {
        if (window.innerWidth > 850) setMenu(false);
      });
    }

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    root.classList.add("motion-ready");

    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
    } else {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

      revealItems.forEach((item) => observer.observe(item));
    }

    if (canvas && hero && !reduceMotion) {
      initSequence(hero, pin, canvas);
    }

    initCounters(reduceMotion);
  };

  const initCounters = (reduceMotion) => {
    const counters = Array.from(document.querySelectorAll("[data-count]"));
    if (!counters.length) return;

    const finish = (el) => {
      el.textContent = el.getAttribute("data-count");
    };

    if (reduceMotion || !("IntersectionObserver" in window)) {
      counters.forEach(finish);
      return;
    }

    const easeOut = (t) => 1 - ((1 - t) ** 2);
    const run = (el, delay) => {
      const end = Number(el.getAttribute("data-count"));
      if (!Number.isFinite(end)) return;
      const startValue = end > 99 ? end - 28 : 0;
      const duration = end > 99 ? 700 : 1000;
      el.textContent = String(startValue);
      window.setTimeout(() => {
        const startTime = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - startTime) / duration);
          el.textContent = String(Math.round(startValue + (end - startValue) * easeOut(t)));
          if (t < 1) requestAnimationFrame(step);
          else finish(el);
        };
        requestAnimationFrame(step);
      }, delay);
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        Array.from(entry.target.querySelectorAll("[data-count]")).forEach((el, index) => {
          run(el, index * 90);
        });
      });
    }, { threshold: 0.35 });

    const strip = document.querySelector(".trust-grid");
    if (strip) observer.observe(strip);
    else counters.forEach(finish);
  };

  const initSequence = (hero, pin, canvas) => {
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    const frames = new Array(FRAME_COUNT);
    let current = -1;
    let lastFrame = null;
    let cssWidth = 0;
    let cssHeight = 0;
    let drawX = 0;
    let drawY = 0;
    let drawWidth = 0;
    let drawHeight = 0;
    let coverReady = false;
    let target = 0;
    let smoothed = 0;
    let running = false;
    const loading = new Set();
    const PREFETCH = 12;

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cssWidth = canvas.clientWidth;
      cssHeight = canvas.clientHeight;
      if (!cssWidth || !cssHeight) return;
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      coverReady = false;
    };

    const updateCover = (img) => {
      const imageRatio = img.width / img.height;
      const canvasRatio = cssWidth / cssHeight;
      drawWidth = cssWidth;
      drawHeight = cssHeight;
      drawX = 0;
      drawY = 0;
      if (imageRatio > canvasRatio) {
        drawWidth = cssHeight * imageRatio;
        drawX = (cssWidth - drawWidth) / 2;
      } else {
        drawHeight = cssWidth / imageRatio;
        drawY = (cssHeight - drawHeight) / 2;
      }
      coverReady = true;
    };

    const drawCover = (img) => {
      if (!img || !cssWidth || !cssHeight) return;
      if (!coverReady) updateCover(img);
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    };

    const progress = () => {
      if (!pin) return 0;
      const extra = Math.max(1, pin.offsetHeight - window.innerHeight);
      return Math.min(1, Math.max(0, window.scrollY / extra));
    };

    const frameAt = (value) => Math.min(FRAME_COUNT - 1, (value * (FRAME_COUNT - 1) + 0.5) | 0);

    const nearestFrame = (index) => {
      if (frames[index]) return frames[index];
      for (let step = 1; step < 6; step += 1) {
        if (frames[index + step]) return frames[index + step];
        if (frames[index - step]) return frames[index - step];
      }
      return lastFrame;
    };

    const applyParallax = (value) => {
      const easeOut = 1 - (1 - value) * (1 - value);
      hero.style.setProperty("--p-bg", `${(easeOut * 56).toFixed(2)}px`);
      hero.style.setProperty("--p-scale", (1.12 - easeOut * 0.07).toFixed(4));
      hero.style.setProperty("--p-copy", `${(-easeOut * 36).toFixed(2)}px`);
      hero.style.setProperty("--p-card", `${(-easeOut * 64).toFixed(2)}px`);
      hero.style.setProperty("--p-lines", `${(easeOut * 22).toFixed(2)}px`);
      hero.style.setProperty("--p-glow-x", `${(-easeOut * 40).toFixed(2)}px`);
      hero.style.setProperty("--p-glow-y", `${(easeOut * 52).toFixed(2)}px`);
      hero.style.setProperty("--p-foot", `${(easeOut * 24).toFixed(2)}px`);
    };

    const loadImage = (n) => new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        const store = (bitmap) => {
          frames[n - 1] = bitmap;
          resolve(bitmap);
        };
        if (typeof createImageBitmap === "function") {
          createImageBitmap(img).then(store).catch(() => store(img));
        } else {
          store(img);
        }
      };
      img.onerror = () => resolve(null);
      img.src = frameSrc(n);
    });

    const ensureFrames = (neededIndex) => {
      const targetIndex = Math.min(FRAME_COUNT, Math.max(neededIndex + 1 + PREFETCH, 1));
      for (let n = 1; n <= targetIndex; n += 1) {
        if (frames[n - 1] || loading.has(n)) continue;
        loading.add(n);
        loadImage(n).then(() => {
          loading.delete(n);
          current = -1;
        });
      }
    };

    const paint = (value) => {
      applyParallax(value);
      const index = frameAt(value);
      ensureFrames(index);
      const img = nearestFrame(index);
      if (!img || index === current) return;
      current = index;
      lastFrame = img;
      drawCover(img);
    };

    const tick = () => {
      target = progress();
      smoothed += (target - smoothed) * EASE;
      if (Math.abs(target - smoothed) < 0.0006) {
        smoothed = target;
        running = false;
      } else {
        requestAnimationFrame(tick);
      }
      paint(smoothed);
    };

    const requestTick = () => {
      if (running) return;
      running = true;
      requestAnimationFrame(tick);
    };

    const boot = async () => {
      await loadImage(1);
      hero.classList.add("has-sequence");
      size();
      current = -1;
      ensureFrames(0);
      requestTick();
    };

    size();
    window.addEventListener("resize", () => {
      size();
      current = -1;
      requestTick();
    });
    window.addEventListener("scroll", requestTick, { passive: true });
    boot();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
