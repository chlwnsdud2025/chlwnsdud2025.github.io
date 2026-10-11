(() => {
  "use strict";

  const projects = window.portfolioProjects;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const videoControllers = [];
  const number = (value) => String(value).padStart(2, "0");
  const setText = (selector, value) => {
    const element = $(selector);
    if (element) element.textContent = value;
  };
  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
    const value = Math.floor(seconds);
    return number(Math.floor(value / 60)) + ":" + number(value % 60);
  };

  function setupVideo(video) {
    if (!video) return null;
    let visible = !("IntersectionObserver" in window);
    let wantsPlayback = !reducedMotion.matches;
    let automaticPlayEvents = 0;
    let automaticPauseEvents = 0;
    video.removeAttribute("autoplay");
    video.muted = true;
    video.playsInline = true;

    const play = () => {
      if (!visible || !wantsPlayback || document.hidden) return;
      const wasPaused = video.paused;
      const attempt = video.play();
      if (wasPaused && !video.paused) automaticPlayEvents += 1;
      if (attempt) attempt.catch(() => {}); // Native controls remain available.
    };
    const suspend = () => {
      if (!video.paused) {
        automaticPauseEvents += 1;
        video.pause();
      }
    };
    video.addEventListener("play", () => {
      if (automaticPlayEvents > 0) automaticPlayEvents -= 1;
      else wantsPlayback = true;
    });
    video.addEventListener("pause", () => {
      if (automaticPauseEvents > 0) automaticPauseEvents -= 1;
      else wantsPlayback = false;
    });
    video.addEventListener("loadeddata", play);
    video.addEventListener("error", () => {
      video.classList.add("has-video-error");
      video.setAttribute("aria-label", "프로젝트 트레일러를 불러오지 못했습니다. 다시 재생해 주세요.");
    });
    const source = video.dataset.src || video.getAttribute("src") || projects[0].video;
    if (video.getAttribute("src") !== source) video.src = source;

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        if (visible) play();
        else suspend();
      }, { threshold: 0.2 });
      observer.observe(video);
    } else {
      play();
    }

    const controller = {
      changeSource(project) {
        video.poster = project.poster;
        video.setAttribute("aria-label", project.title + " 플레이 트레일러");
        if (video.getAttribute("src") !== project.video) {
          suspend();
          video.src = project.video;
          video.load();
        }
      },
      restart() {
        if (video.readyState >= 1) video.currentTime = 0;
        play();
      },
      toggle() {
        if (video.paused) {
          wantsPlayback = true;
          visible = true;
          play();
        } else {
          wantsPlayback = false;
          video.pause();
        }
      },
      reduceMotion() {
        wantsPlayback = false;
        suspend();
      },
      visibilityChanged() {
        if (document.hidden) suspend();
        else play();
      },
    };
    videoControllers.push(controller);
    return controller;
  }

  const heroVideo = $("#hero-video");
  const heroPlayer = setupVideo(heroVideo);
  const heroToggle = $("#hero-toggle");
  const heroProgress = $("#hero-progress");
  let heroIndex = 0;

  function updateHeroProgress() {
    if (!heroVideo) return;
    const duration = Number.isFinite(heroVideo.duration) ? heroVideo.duration : 0;
    const current = heroVideo.currentTime || 0;
    setText("#hero-current", formatTime(current));
    setText("#hero-duration", formatTime(duration));
    if (heroProgress) {
      const percent = duration ? (current / duration) * 100 : 0;
      heroProgress.value = String(percent);
      heroProgress.disabled = duration === 0;
      heroProgress.style.setProperty("--progress", percent + "%");
      heroProgress.setAttribute("aria-valuetext", formatTime(current) + " / " + formatTime(duration));
    }
  }

  function updateHeroToggle() {
    if (!heroVideo || !heroToggle) return;
    const playing = !heroVideo.paused;
    heroToggle.textContent = playing ? "Ⅱ" : "▶";
    heroToggle.dataset.playing = String(playing);
    heroToggle.setAttribute("aria-label", playing ? "영상 일시 정지" : "영상 재생");
    heroToggle.setAttribute("aria-pressed", String(playing));
  }

  if (heroVideo) {
    ["loadedmetadata", "timeupdate", "durationchange", "emptied"].forEach((event) => {
      heroVideo.addEventListener(event, updateHeroProgress);
    });
    ["play", "pause", "ended", "error"].forEach((event) => {
      heroVideo.addEventListener(event, updateHeroToggle);
    });
    heroToggle?.addEventListener("click", () => heroPlayer?.toggle());
    if (heroProgress) {
      heroProgress.min = "0";
      heroProgress.max = "100";
      heroProgress.step = "0.1";
      heroProgress.addEventListener("input", () => {
        if (Number.isFinite(heroVideo.duration) && heroVideo.duration > 0) {
          heroVideo.currentTime = (Number(heroProgress.value) / 100) * heroVideo.duration;
          updateHeroProgress();
        }
      });
    }
    updateHeroProgress();
    updateHeroToggle();
  }

  function showHero(index) {
    heroIndex = (index + projects.length) % projects.length;
    const project = projects[heroIndex];
    setText("#hero-project-title", project.title);
    setText("#hero-project-description", project.description);
    setText("#hero-index", number(heroIndex + 1) + " / " + number(projects.length));
    heroPlayer?.changeSource(project);
    const heroLink = $("#hero-project-link");
    if (heroLink) {
      heroLink.href = project.detailUrl;
      heroLink.setAttribute("aria-label", project.title + " 상세 페이지");
    }
    heroPlayer?.restart();
    updateHeroProgress();
  }
  $("#hero-prev")?.addEventListener("click", () => showHero(heroIndex - 1));
  $("#hero-next")?.addEventListener("click", () => showHero(heroIndex + 1));
  showHero(0);

  const carousel = $("#project-carousel");
  const stage = $("#project-stage");
  const track = $("#project-track");
  const dots = $("#project-dots");
  let activeIndex = 0;
  const cloneCount = 3;
  let trackIndex = cloneCount;
  let sliding = false;
  let slideTimer = null;
  let pendingIndex = null;
  let projectVisible = false;
  const genres = projects.map(project => project.genre);

  function projectCard(project, index, clone = false) {
    const card = document.createElement("article");
    card.className = "project-card";
    card.dataset.projectIndex = String(index);
    card.setAttribute("aria-label", `${number(index + 1)} / ${number(projects.length)} · ${project.title}`);
    if (clone) card.dataset.clone = "true";
    card.innerHTML = `
      <div class="project-slide">
        <a class="project-media" href="${project.detailUrl}" aria-label="${project.title} 상세 페이지">
          <div class="project-video-frame">
            <video muted loop playsinline preload="none" poster="${project.poster}" data-src="${project.video}" aria-hidden="true"></video>
            <span class="trailer-label"><span></span>REAL GAMEPLAY</span>
            <div class="project-media-overlay"><span class="mini-label">${genres[index]}</span><p>${project.caption}</p></div>
          </div>
        </a>
        <a class="project-information" data-index="${number(index + 1)}" href="${project.detailUrl}" aria-label="${project.title} 구현 사례 상세 보기">
          <span class="project-category">GAME DEVELOPMENT <i></i> ${number(index + 1)} / ${number(projects.length)}</span>
          <h3>${project.title}</h3>
          <p class="project-goal">${project.goal}</p>
          <div class="project-details-block"><h4>HOW IT WORKS <span>↗</span></h4><ul>${project.details.map((detail) => `<li>${detail}</li>`).join("")}</ul></div>
          <div class="project-tags">${project.tags.map((tag) => `<span>${tag}</span>`).join("")}</div>
          <dl class="project-meta"><div><dt>개발 형태</dt><dd>${project.type}</dd></div><div><dt>담당 역할</dt><dd>${project.role}</dd></div><div><dt>개발 기간</dt><dd>${project.period}</dd></div></dl>
        </a>
      </div>`;
    return card;
  }

  if (track) {
    const cards = [];
    for (let offset = -cloneCount; offset < projects.length + cloneCount; offset += 1) {
      const index = (offset + projects.length * 2) % projects.length;
      cards.push(projectCard(projects[index], index, offset < 0 || offset >= projects.length));
    }
    track.replaceChildren(...cards);
  }

  function trackOffset(index) {
    if (!stage || !track) return 0;
    const card = track.querySelector(".project-card");
    if (!card) return 0;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const width = card.offsetWidth;
    return stage.clientWidth / 2 - (index * (width + gap) + width / 2);
  }

  function positionTrack() {
    if (!track) return;
    track.style.transition = "none";
    track.style.transform = `translate3d(${trackOffset(trackIndex)}px,0,0)`;
  }

  function finishSlide() {
    if (!sliding) return;
    clearTimeout(slideTimer);
    slideTimer = null;
    const canonical = cloneCount + activeIndex;
    if (trackIndex !== canonical) {
      const outgoing = track.children[trackIndex]?.querySelector("video");
      const incoming = track.children[canonical]?.querySelector("video");
      if (outgoing && incoming && outgoing.readyState > 0) {
        if (!incoming.getAttribute("src")) incoming.src = incoming.dataset.src;
        try { incoming.currentTime = outgoing.currentTime; } catch (_) {}
      }
      trackIndex = canonical;
      track.children[canonical]?.classList.add("no-content-animation");
      positionTrack();
    }
    sliding = false;
    markProject(false);
    if (pendingIndex !== null) {
      const next = pendingIndex;
      pendingIndex = null;
      if (next !== activeIndex) selectProject(next);
    }
  }

  function updateProjectVideo() {
    if (!track) return;
    track.querySelectorAll(".project-card video").forEach((video, index) => {
      const active = index === trackIndex;
      if (!active || !projectVisible || document.hidden || reducedMotion.matches) {
        video.pause();
        return;
      }
      if (!video.getAttribute("src")) video.src = video.dataset.src;
      video.play().catch(() => {});
    });
  }

  function markProject(announce = true) {
    if (!track) return;
    track.querySelectorAll(".project-card").forEach((card, index) => {
      const active = index === trackIndex;
      if (!active) card.classList.remove("no-content-animation");
      card.classList.toggle("is-active", active);
      card.setAttribute("aria-hidden", String(!active));
      card.querySelectorAll("a").forEach(link => link.tabIndex = active ? 0 : -1);
    });
    dots?.querySelectorAll("button").forEach((dot, index) => {
      dot.classList.toggle("is-active", index === activeIndex);
      if (index === activeIndex) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
    setText("#project-index", `${number(activeIndex + 1)} / ${number(projects.length)}`);
    if (announce) setText("#project-announcement", `${activeIndex + 1} / ${projects.length} · ${projects[activeIndex].title}`);
    updateProjectVideo();
  }

  function selectProject(index) {
    if (!track) return;
    const next = (index + projects.length) % projects.length;
    if (sliding) { pendingIndex = next; return; }
    if (next === activeIndex) return;
    const direction = (next - activeIndex + projects.length) % projects.length === 1 ? 1 : -1;
    const from = trackIndex;
    activeIndex = next;
    trackIndex += direction;
    if (reducedMotion.matches) {
      trackIndex = cloneCount + activeIndex;
      positionTrack();
      markProject();
      return;
    }
    sliding = true;
    track.style.transition = "none";
    track.style.transform = `translate3d(${trackOffset(from)}px,0,0)`;
    void track.offsetWidth;
    markProject();
    track.style.transition = "transform 620ms cubic-bezier(.22,.72,.18,1)";
    track.style.transform = `translate3d(${trackOffset(trackIndex)}px,0,0)`;
    slideTimer = setTimeout(finishSlide, 720);
  }

  track?.addEventListener("transitionend", (event) => {
    if (event.target === track && event.propertyName === "transform") finishSlide();
  });

  if (dots) {
    dots.replaceChildren(...projects.map((project, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "project-dot";
      dot.setAttribute("aria-label", project.title + " 프로젝트 보기");
      dot.addEventListener("click", () => selectProject(index));
      return dot;
    }));
  }
  $("#project-prev")?.addEventListener("click", () => selectProject(activeIndex - 1));
  $("#project-next")?.addEventListener("click", () => selectProject(activeIndex + 1));
  stage?.addEventListener("click", (event) => {
    const card = event.target.closest(".project-card");
    if (!card || card.classList.contains("is-active")) return;
    event.preventDefault();
    selectProject(Number(card.dataset.projectIndex));
  });
  const isMediaOrInput = (target) => target instanceof Element &&
    Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
  carousel?.addEventListener("keydown", (event) => {
    if (isMediaOrInput(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      selectProject(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
    }
  });
  let touchStart = null;
  stage?.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) return;
    touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true });
  stage?.addEventListener("touchend", (event) => {
    if (!touchStart) return;
    const x = event.changedTouches[0].clientX - touchStart.x;
    const y = event.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(x) > 50 && Math.abs(x) > Math.abs(y) * 1.5) selectProject(activeIndex + (x < 0 ? 1 : -1));
  }, { passive: true });
  stage?.addEventListener("touchcancel", () => { touchStart = null; }, { passive: true });
  window.addEventListener("resize", () => { if (sliding) finishSlide(); positionTrack(); });
  document.addEventListener("visibilitychange", updateProjectVideo);
  if (carousel && "IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      projectVisible = entries[0].isIntersecting;
      updateProjectVideo();
    }, { threshold: 0.18 }).observe(carousel);
  } else {
    projectVisible = true;
  }
  markProject(false);
  requestAnimationFrame(positionTrack);

  const menuToggle = $(".menu-toggle");
  const siteNav = $("#site-nav");
  const closeMenu = () => {
    menuToggle?.setAttribute("aria-expanded", "false");
    menuToggle?.setAttribute("aria-label", "메뉴 열기");
    siteNav?.classList.remove("is-open");
  };
  menuToggle?.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") !== "true";
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    siteNav?.classList.toggle("is-open", open);
  });
  siteNav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  window.matchMedia("(max-width: 780px)").addEventListener("change", closeMenu);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuToggle?.getAttribute("aria-expanded") === "true") {
      closeMenu();
      menuToggle.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (siteNav && !siteNav.contains(event.target) && !menuToggle?.contains(event.target)) closeMenu();
  });

  const header = $(".site-header");
  const backToTop = $("#back-to-top");
  let scrollQueued = false;
  const updateScroll = () => {
    header?.classList.toggle("is-scrolled", window.scrollY > 24);
    if (backToTop) {
      const show = window.scrollY > 600;
      backToTop.classList.toggle("is-visible", show);
      backToTop.tabIndex = show ? 0 : -1;
      backToTop.setAttribute("aria-hidden", String(!show));
    }
    scrollQueued = false;
  };
  window.addEventListener("scroll", () => {
    if (!scrollQueued) {
      scrollQueued = true;
      window.requestAnimationFrame(updateScroll);
    }
  }, { passive: true });
  backToTop?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? "instant" : "smooth" });
  });
  updateScroll();

  const revealElements = [...document.querySelectorAll(".reveal")];
  const counters = [...document.querySelectorAll(".count-up[data-count]")];
  const countFrames = new Map();
  function showCounter(element, animate) {
    const target = Number(element.dataset.count);
    if (!Number.isFinite(target)) return;
    const width = element.dataset.pad || String(target).length;
    const display = (value) => { element.textContent = String(value).padStart(Number(width), "0"); };
    if (!animate) {
      window.cancelAnimationFrame(countFrames.get(element));
      countFrames.delete(element);
      display(target);
      return;
    }
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / 750, 1);
      display(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) countFrames.set(element, window.requestAnimationFrame(tick));
      else countFrames.delete(element);
    };
    countFrames.set(element, window.requestAnimationFrame(tick));
  }
  let revealObserver;
  if (!reducedMotion.matches && "IntersectionObserver" in window) {
    document.documentElement.classList.add("js-reveal");
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        if (entry.target.matches(".count-up[data-count]")) showCounter(entry.target, true);
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -24px 0px" });
    [...new Set([...revealElements, ...counters])].forEach((element) => revealObserver.observe(element));
  } else {
    revealElements.forEach((element) => element.classList.add("is-visible"));
    counters.forEach((element) => showCounter(element, false));
  }
  reducedMotion.addEventListener("change", () => {
    if (!reducedMotion.matches) return;
    videoControllers.forEach((controller) => controller.reduceMotion());
    revealObserver?.disconnect();
    revealElements.forEach((element) => element.classList.add("is-visible"));
    counters.forEach((element) => showCounter(element, false));
    if (sliding) finishSlide();
    trackIndex = cloneCount + activeIndex;
    positionTrack();
    markProject(false);
    updateProjectVideo();
  });
  document.addEventListener("visibilitychange", () => {
    videoControllers.forEach((controller) => controller.visibilityChanged());
  });
})();
