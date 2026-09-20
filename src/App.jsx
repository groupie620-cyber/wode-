import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  ChevronRight,
  CircleAlert,
  Github,
  Linkedin,
  Mail,
  Menu,
  MessageCircleMore,
  Mic2,
  Music2,
  RefreshCw,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { portfolioData } from "./data.js";

const iconMap = {
  activity: Activity,
  music: Music2,
  mic: Mic2,
  mail: Mail,
  linkedin: Linkedin,
  github: Github,
};

const accentMap = {
  sage: "bg-[#E4EADF] text-[#52614F]",
  clay: "bg-[#F0DED6] text-[#8C4E39]",
  sand: "bg-[#F2E5C9] text-[#755C2D]",
};

function SectionHeading({ eyebrow, title, note, light = false }) {
  return (
    <div className="max-w-3xl" data-reveal>
      <p className={`eyebrow ${light ? "text-[#F0D6C9]" : "text-clay"}`}>{eyebrow}</p>
      <h2 className={`section-title ${light ? "text-white" : "text-ink"}`}>{title}</h2>
      {note ? <p className={`mt-5 max-w-2xl text-lg ${light ? "text-white/70" : "text-muted"}`}>{note}</p> : null}
    </div>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const { site, profile, contact } = portfolioData;
  const hasContact = Boolean(profile.email || contact.socialLinks.length);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line/70 bg-cream/90 backdrop-blur-xl">
      <div className="site-shell flex h-[72px] items-center justify-between">
        <a href="#home" className="group flex items-center gap-3" aria-label="返回首页">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-ink font-display text-sm text-white transition-transform group-hover:-rotate-6">
            {profile.initials}
          </span>
          <span className="font-display text-lg font-bold tracking-tight">{profile.name}</span>
        </a>

        <nav className="hidden items-center gap-7 md:flex" aria-label="主导航">
          {site.navigation.map((item) => (
            <a key={item.href} className="nav-link" href={item.href}>
              {item.label}
            </a>
          ))}
          {hasContact ? (
            <a className="rounded-full bg-ink px-5 py-2.5 font-sans text-sm font-semibold text-white transition hover:bg-clay" href="#contact">
              联系我
            </a>
          ) : null}
        </nav>

        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-full border border-line bg-paper md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          aria-label={open ? "关闭导航" : "打开导航"}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open ? (
        <nav id="mobile-navigation" className="border-t border-line bg-paper px-5 py-4 shadow-card md:hidden" aria-label="移动端导航">
          {site.navigation.map((item) => (
            <a key={item.href} className="flex min-h-12 items-center justify-between border-b border-line/60 py-3 font-sans text-sm font-semibold" href={item.href} onClick={() => setOpen(false)}>
              {item.label}
              <ChevronRight size={17} aria-hidden="true" />
            </a>
          ))}
          {hasContact ? (
            <a className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-ink font-sans text-sm font-semibold text-white" href="#contact" onClick={() => setOpen(false)}>
              联系我
            </a>
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}

function PhotoCarousel() {
  const photos = portfolioData.profile.photos;
  const [activeIndex, setActiveIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const touchStart = useRef(null);
  const activePhoto = photos[activeIndex];

  if (!activePhoto) return null;

  const goTo = (index) => {
    setFailed(false);
    setActiveIndex((index + photos.length) % photos.length);
  };

  const handleTouchEnd = (event) => {
    if (touchStart.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(distance) > 45) goTo(activeIndex + (distance < 0 ? 1 : -1));
    touchStart.current = null;
  };

  return (
    <div className="photo-card relative h-full min-h-[390px] overflow-hidden rounded-card bg-[#DED2BF] shadow-float" data-reveal>
      <button
        type="button"
        className="group absolute inset-0 w-full cursor-pointer overflow-hidden text-left"
        onClick={() => goTo(activeIndex + 1)}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") goTo(activeIndex + 1);
          if (event.key === "ArrowLeft") goTo(activeIndex - 1);
        }}
        onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }}
        onTouchEnd={handleTouchEnd}
        aria-label={`当前为第 ${activeIndex + 1} 张照片。点击切换下一张，也可使用键盘方向键。`}
      >
        {failed ? (
          <span className="grid h-full place-items-center bg-sage/20 font-display text-7xl text-sage">{portfolioData.profile.initials}</span>
        ) : (
          <img
            key={activePhoto.src}
            src={activePhoto.src}
            alt={activePhoto.alt}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
            onError={() => setFailed(true)}
          />
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" aria-hidden="true" />
        <span className="absolute bottom-7 left-7 right-7 flex items-end justify-between text-white">
          <span>
            <span className="block font-sans text-[11px] font-bold tracking-[0.2em] text-white/70">CLICK TO CHANGE</span>
            <span className="mt-1 block font-display text-xl">{activePhoto.caption}</span>
          </span>
          <span className="grid h-11 w-11 place-items-center rounded-full border border-white/40 bg-white/10 backdrop-blur-sm transition group-hover:bg-white group-hover:text-ink">
            <ArrowRight size={19} />
          </span>
        </span>
      </button>

      {photos.length > 1 ? (
        <>
          <button className="carousel-arrow left-4" type="button" onClick={() => goTo(activeIndex - 1)} aria-label="上一张照片">
            <ArrowLeft size={18} />
          </button>
          <button className="carousel-arrow right-4" type="button" onClick={() => goTo(activeIndex + 1)} aria-label="下一张照片">
            <ArrowRight size={18} />
          </button>
        </>
      ) : null}

      <div className="absolute right-4 top-3 flex gap-0 sm:right-6 sm:top-5" role="group" aria-label="选择照片">
        {photos.map((photo, index) => (
          <button
            key={photo.src}
            type="button"
            onClick={() => goTo(index)}
            className="group grid h-11 w-11 place-items-center"
            aria-label={`显示第 ${index + 1} 张照片`}
            aria-current={index === activeIndex ? "true" : undefined}
          >
            <span className={`h-2 rounded-full transition-all ${index === activeIndex ? "w-7 bg-white" : "w-2 bg-white/55 group-hover:bg-white"}`} aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">正在显示第 {activeIndex + 1} 张照片：{activePhoto.alt}</p>
    </div>
  );
}

function Hero() {
  const { profile, site, highlights } = portfolioData;
  const hasPhotos = profile.photos.length > 0;

  return (
    <section id="home" className="site-shell scroll-mt-28 pb-14 pt-32 sm:pt-36 lg:min-h-[760px] lg:pb-24">
      <div className="grid gap-5 lg:grid-cols-12">
        <div className={`bento-card relative overflow-hidden px-6 py-9 sm:px-10 sm:py-12 lg:px-12 lg:py-14 ${hasPhotos ? "lg:col-span-7" : "lg:col-span-12"}`} data-reveal>
          <div className="paper-grain" aria-hidden="true" />
          <div className="relative z-10">
            <p className="inline-flex items-center gap-2 rounded-full border border-sage/25 bg-sage/10 px-3.5 py-2 font-sans text-xs font-bold tracking-wide text-[#52614F]">
              <span className="h-2 w-2 rounded-full bg-sage motion-safe:animate-pulse" />
              {site.status}
            </p>
            <p className="mt-10 font-sans text-sm font-bold uppercase tracking-[0.22em] text-muted">Hello, I’m</p>
            <h1 className="mt-2 font-display text-[clamp(2.75rem,11vw,6.8rem)] font-bold leading-[0.94] tracking-[-0.055em] text-ink">
              {profile.name}
            </h1>
            <p className="mt-4 font-sans text-sm font-semibold tracking-wide text-clay sm:text-base">{profile.role}</p>
            <p className="mt-9 max-w-[20ch] font-display text-2xl leading-snug text-ink sm:text-3xl">“{profile.statement}”</p>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">{profile.intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a className="button-secondary" href="#ama">
                <MessageCircleMore size={18} /> 进入 AMA 对话
              </a>
            </div>
          </div>
        </div>

        {hasPhotos ? <div className="lg:col-span-5"><PhotoCarousel /></div> : null}

        <div className={`grid grid-cols-3 gap-3 ${hasPhotos ? "lg:col-span-7" : "lg:col-span-8"}`} data-reveal>
          {highlights.map((item) => (
            <div key={item.label} className="rounded-2xl border border-line bg-paper px-3 py-5 text-center sm:px-5">
              <strong className="block font-display text-2xl text-ink sm:text-3xl">{item.value}</strong>
              <span className="mt-1 block font-sans text-[11px] font-semibold tracking-wide text-muted sm:text-xs">{item.label}</span>
            </div>
          ))}
        </div>

        <a href="#about" className={`group flex min-h-28 items-center justify-between rounded-card bg-ink px-7 py-6 text-white ${hasPhotos ? "lg:col-span-5" : "lg:col-span-4"}`} data-reveal>
          <span>
            <span className="block font-sans text-[11px] font-bold tracking-[0.2em] text-white/55">SCROLL TO EXPLORE</span>
            <span className="mt-1 block font-display text-xl">继续认识我</span>
          </span>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 transition group-hover:translate-y-1 group-hover:bg-white group-hover:text-ink">
            <ArrowDown size={20} />
          </span>
        </a>
      </div>
    </section>
  );
}

function About() {
  const { about, hobbies } = portfolioData;

  return (
    <section id="about" className="scroll-mt-24 border-y border-line/70 bg-paper/55 py-20 sm:py-28">
      <div className="site-shell">
        <SectionHeading eyebrow={about.eyebrow} title={about.title} />
        <div className="mt-10 grid gap-5 lg:grid-cols-12">
          <article className={`bento-card flex flex-col justify-between p-7 sm:p-9 ${about.style ? "lg:col-span-7" : "lg:col-span-12"}`} data-reveal>
            <Sparkles className="text-clay" size={29} strokeWidth={1.6} aria-hidden="true" />
            <p className="mt-16 max-w-3xl font-display text-xl leading-[1.9] text-ink sm:text-2xl">{about.story}</p>
          </article>

          {about.style ? (
            <article className="rounded-card bg-sage p-7 text-white shadow-card sm:p-9 lg:col-span-5" data-reveal>
              <p className="eyebrow text-white/80">{about.style.label}</p>
              <div className="mt-9 flex items-end justify-between gap-4">
                <span className="font-display text-6xl font-bold tracking-tight sm:text-7xl">{about.style.mbti}</span>
                <UserRound size={42} strokeWidth={1.2} className="text-white/70" aria-hidden="true" />
              </div>
              <h3 className="mt-6 font-display text-2xl">{about.style.title}</h3>
              <p className="mt-3 leading-7 text-white/90">{about.style.description}</p>
            </article>
          ) : null}

          {about.values.length ? <div className="grid gap-3 sm:grid-cols-2 lg:col-span-12 lg:grid-cols-4" data-reveal>
            {about.values.map((value) => (
              <article key={value.number} className="rounded-2xl border border-line bg-cream/60 p-6">
                <span className="font-sans text-xs font-bold tracking-widest text-clay">{value.number}</span>
                <h3 className="mt-8 font-display text-2xl">{value.title}</h3>
                <p className="mt-1 text-muted">{value.description}</p>
              </article>
            ))}
          </div> : null}
        </div>

        {hobbies.groups.length ? <div className="mt-24">
          <SectionHeading eyebrow={hobbies.eyebrow} title={hobbies.title} />
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {hobbies.groups.map((group) => {
              const Icon = iconMap[group.icon] || Sparkles;
              return (
                <article key={group.title} className="bento-card p-7 sm:p-8" data-reveal>
                  <div className={`grid h-14 w-14 place-items-center rounded-2xl ${accentMap[group.accent]}`}>
                    <Icon size={25} strokeWidth={1.7} aria-hidden="true" />
                  </div>
                  <h3 className="mt-10 font-display text-2xl">{group.title}</h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {group.items.map((item) => <span key={item} className="rounded-full border border-line bg-cream/60 px-3 py-1 font-sans text-xs font-semibold text-muted">{item}</span>)}
                  </div>
                  <p className="mt-6 leading-7 text-muted">{group.note}</p>
                </article>
              );
            })}
          </div>
        </div> : null}
      </div>
    </section>
  );
}

function Projects() {
  const { projects } = portfolioData;

  return (
    <section id="projects" className="site-shell scroll-mt-24 py-20 sm:py-28">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <SectionHeading eyebrow={projects.eyebrow} title={projects.title} />
        <p className="max-w-md text-muted" data-reveal>{projects.note}</p>
      </div>
      <div className="mt-10 grid gap-5 lg:grid-cols-12">
        {projects.items.map((project, index) => (
          <article key={project.id} className={`bento-card group overflow-hidden ${index === 0 ? "lg:col-span-7" : index === 1 ? "lg:col-span-5" : "lg:col-span-12 lg:grid lg:grid-cols-2"}`} data-reveal>
            <div className={`relative overflow-hidden bg-[#E8DFD2] ${index === 2 ? "min-h-[260px]" : "aspect-[16/10]"}`}>
              <img className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" src={project.image} alt={project.imageAlt} />
              <span className="absolute left-5 top-5 rounded-full bg-paper/90 px-3 py-1 font-sans text-[11px] font-bold tracking-wider text-ink backdrop-blur">{project.category}</span>
              <span className="absolute bottom-4 right-5 font-display text-5xl text-white/80">{project.index}</span>
            </div>
            <div className="flex flex-col p-7 sm:p-8">
              <h3 className="font-display text-2xl leading-snug sm:text-3xl">{project.title}</h3>
              <p className="mt-4 leading-7 text-muted">{project.summary}</p>
              <dl className="mt-6 space-y-4 border-t border-line pt-5">
                <div>
                  <dt className="font-sans text-[11px] font-bold tracking-[0.14em] text-clay">我的贡献</dt>
                  <dd className="mt-1 text-sm leading-6 text-muted">{project.contribution}</dd>
                </div>
                <div>
                  <dt className="font-sans text-[11px] font-bold tracking-[0.14em] text-clay">结果 / 收获</dt>
                  <dd className="mt-1 text-sm leading-6 text-muted">{project.result}</dd>
                </div>
              </dl>
              <div className="mt-6 flex flex-wrap gap-2">
                {project.tags.map((tag) => <span key={tag} className="rounded-full bg-sage/10 px-3 py-1 font-sans text-xs font-semibold text-sage">#{tag}</span>)}
              </div>
              {project.url ? (
                <a className="mt-7 inline-flex items-center gap-2 font-sans text-sm font-bold text-ink underline decoration-clay underline-offset-4" href={project.url} target="_blank" rel="noreferrer">
                  查看作品 <ArrowUpRight size={16} />
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Journey() {
  const { journey } = portfolioData;

  return (
    <section id="journey" className="scroll-mt-24 bg-[#E5D7C5] py-20 sm:py-28">
      <div className="site-shell grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5 lg:sticky lg:top-28 lg:self-start">
          <SectionHeading eyebrow={journey.eyebrow} title={journey.title} />
        </div>
        <ol className="space-y-4 lg:col-span-7">
          {journey.items.map((item, index) => (
            <li key={`${item.period}-${item.title}`} className="relative rounded-card border border-white/60 bg-paper/75 p-7 shadow-card backdrop-blur sm:p-8" data-reveal>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-sans text-xs font-bold tracking-[0.16em] text-clay">{item.type}</p>
                  <h3 className="mt-3 font-display text-2xl">{item.title}</h3>
                </div>
                {item.period ? <span className="shrink-0 rounded-full border border-line bg-cream px-3 py-1 font-sans text-xs font-semibold text-muted">{item.period}</span> : null}
              </div>
              <p className="mt-5 max-w-2xl leading-7 text-muted">{item.description}</p>
              <span className="absolute bottom-5 right-6 font-display text-5xl text-ink/[0.045]">0{index + 1}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ChatMessage({ message }) {
  const isAssistant = message.role === "assistant";
  return (
    <div className={`flex gap-3 ${isAssistant ? "" : "flex-row-reverse"}`}>
      <span className="sr-only">{isAssistant ? "AMA AI" : "访客"}：</span>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${isAssistant ? "bg-sage text-white" : "bg-clay text-white"}`} aria-hidden="true">
        {isAssistant ? <Bot size={17} /> : <UserRound size={17} />}
      </span>
      <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-7 sm:text-[15px] ${isAssistant ? "rounded-tl-sm bg-[#F0ECE4] text-ink" : "rounded-tr-sm bg-ink text-white"}`}>
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

function AmaChat() {
  const { ai } = portfolioData;
  const [messages, setMessages] = useState([{ role: "assistant", content: ai.welcome }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [service, setService] = useState({ loading: true, enabled: null, provider: "", model: "" });
  const scrollRef = useRef(null);
  const serviceLabel = service.loading
    ? "正在检查服务…"
    : service.enabled === false
      ? "服务暂不可用"
      : service.mode === "local"
        ? `本地资料模式 · ${service.knowledgeDocuments || 0} 篇认知资料`
        : `${service.provider} · ${service.knowledgeDocuments || 0} 篇认知资料`;

  useEffect(() => {
    let active = true;
    fetch("/api/chat/status")
      .then((response) => response.json())
      .then((payload) => { if (active) setService({ loading: false, ...payload }); })
      .catch(() => { if (active) setService({ loading: false, enabled: false, provider: "", model: "" }); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, loading, error]);

  const sendMessage = async (question) => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || loading) return;
    if (service.enabled === false) {
      setError("AI 服务暂时不可用。网站内容仍可正常浏览，请稍后再试。");
      return;
    }

    const userMessage = { role: "user", content: cleanQuestion };
    const conversation = [...messages, userMessage].slice(-10);
    setMessages(conversation);
    setInput("");
    setError("");
    setLastQuestion(cleanQuestion);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversation }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "暂时无法连接 AI 服务，请稍后再试。");
      setMessages((current) => [...current, { role: "assistant", content: payload.reply }]);
    } catch (requestError) {
      setError(requestError.message || "暂时无法连接 AI 服务，请稍后再试。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="ama" className="scroll-mt-20 bg-ink py-20 text-white sm:py-28">
      <div className="site-shell grid items-start gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5" data-reveal>
          <SectionHeading eyebrow={ai.eyebrow} title={ai.title} note={ai.description} light />
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.055] p-5">
            <div className="flex gap-3">
              <CircleAlert className="mt-0.5 shrink-0 text-sand" size={18} />
              <p className="text-sm leading-6 text-white/60">{ai.disclaimer}</p>
            </div>
          </div>
          <div className="mt-8">
            <p className="font-sans text-xs font-bold tracking-[0.16em] text-white/60">不知道问什么？试试这些</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ai.quickQuestions.map((question) => (
                <button key={question} type="button" onClick={() => sendMessage(question)} disabled={loading} className="min-h-11 rounded-full border border-white/15 px-4 py-2 font-sans text-xs text-white/75 transition hover:border-white/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">
                  {question}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-card bg-paper text-ink shadow-float lg:col-span-7" data-reveal>
          <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="relative grid h-10 w-10 place-items-center rounded-full bg-sage text-white">
                <Bot size={19} />
                <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-paper ${service.loading ? "bg-sand" : service.enabled === false ? "bg-clay" : "bg-[#64A869]"}`} aria-hidden="true" />
              </span>
              <div>
                <p className="font-sans text-sm font-bold">陈德基的 AMA AI</p>
                <p className="font-sans text-[11px] text-muted" role="status" aria-live="polite">{serviceLabel}</p>
              </div>
            </div>
            <Sparkles size={19} className="text-clay" aria-hidden="true" />
          </div>

          <div ref={scrollRef} className="chat-scroll space-y-5 overflow-y-auto px-4 py-6 sm:px-6" role="log" aria-live="polite" aria-relevant="additions text" aria-label="对话记录">
            {messages.map((message, index) => <ChatMessage key={`${message.role}-${index}`} message={message} />)}
            {loading ? (
              <div className="flex items-center gap-3 text-sm text-muted" role="status">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-sage text-white"><Bot size={17} /></span>
                <span className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-[#F0ECE4] px-4 py-3">
                  <i className="thinking-dot" /><i className="thinking-dot" /><i className="thinking-dot" />
                  <span className="ml-1">AI 正在整理资料…</span>
                </span>
              </div>
            ) : null}
            {error ? (
              <div className="ml-12 rounded-xl border border-clay/25 bg-clay/10 p-3 text-sm text-[#774533]" role="alert">
                <p>{error}</p>
                {lastQuestion ? (
                  <button type="button" className="mt-2 inline-flex items-center gap-1.5 font-sans text-xs font-bold underline" onClick={() => sendMessage(lastQuestion)}>
                    <RefreshCw size={13} /> 重新发送
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <form className="border-t border-line bg-[#FAF7F0] p-4 sm:p-5" onSubmit={(event) => { event.preventDefault(); sendMessage(input); }}>
            <div className="flex items-end gap-2 rounded-2xl border border-line bg-white p-2 focus-within:border-sage focus-within:ring-2 focus-within:ring-sage/10">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, 1200))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    sendMessage(input);
                  }
                }}
                rows={2}
                maxLength={1200}
                placeholder={ai.inputPlaceholder}
                className="max-h-32 min-h-[52px] flex-1 resize-none border-0 bg-transparent px-3 py-2 text-[15px] leading-6 outline-none placeholder:text-muted/60"
                aria-label="输入想问 AMA AI 的问题"
              />
              <button type="submit" disabled={loading || !input.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-clay text-white transition hover:bg-[#8D4C36] disabled:cursor-not-allowed disabled:opacity-35" aria-label="发送问题">
                <Send size={18} />
              </button>
            </div>
            <div className="mt-2 flex justify-between px-1 font-sans text-[10px] text-muted/70">
              <span>Enter 发送 · Shift + Enter 换行</span>
              <span>{input.length}/1200</span>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function Contact({ showToast }) {
  const { contact, profile } = portfolioData;
  const hasEmail = Boolean(profile.email);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
      showToast("邮箱已复制，期待收到你的消息。", true);
    } catch {
      showToast(`邮箱：${profile.email}`);
    }
  };

  return (
    <section id="contact" className="site-shell scroll-mt-24 py-20 sm:py-28">
      <div className="relative overflow-hidden rounded-[2rem] bg-clay px-6 py-12 text-white shadow-float sm:px-12 sm:py-16" data-reveal>
        <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full border border-white/15" aria-hidden="true" />
        <div className="absolute -bottom-40 right-20 h-80 w-80 rounded-full border border-white/10" aria-hidden="true" />
        <div className="relative grid items-end gap-9 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <p className="eyebrow text-white/65">{contact.eyebrow}</p>
            <h2 className="max-w-3xl font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">{contact.title}</h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/70">{contact.note}</p>
          </div>
          <div className="flex flex-col gap-3 lg:col-span-4 lg:items-stretch">
            {hasEmail ? (
              <>
                <a href={`mailto:${profile.email}`} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-white px-5 font-sans text-sm font-bold text-clay transition hover:-translate-y-0.5">
                  <Mail size={18} /> 给我写邮件
                </a>
                <button type="button" onClick={copyEmail} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 px-5 font-sans text-sm font-semibold text-white transition hover:bg-white/10">
                  <Check size={17} /> 复制邮箱
                </button>
              </>
            ) : contact.socialLinks.map((link) => {
              const external = link.url.startsWith("http");
              return (
                <a key={link.label} href={link.url} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="flex min-h-12 items-center justify-center rounded-xl border border-white/25 px-5 font-sans text-sm font-semibold text-white transition hover:bg-white/10">
                  通过 {link.label} 联系
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { site, profile, contact } = portfolioData;
  const showLocalAdmin = import.meta.env.DEV && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  return (
    <footer className="border-t border-line py-8">
      <div className="site-shell flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="font-display text-lg font-bold">{profile.name}</p>
          <p className="mt-1 text-sm text-muted">© {new Date().getFullYear()} · {site.footerNote}</p>
        </div>
        <div className="flex items-center gap-2">
          {contact.socialLinks.map((link) => {
            const Icon = iconMap[link.icon] || ArrowUpRight;
            const external = link.url.startsWith("http");
            return (
              <a key={link.label} href={link.url} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="grid h-11 w-11 place-items-center rounded-full border border-line bg-paper text-muted transition hover:-translate-y-0.5 hover:border-clay hover:text-clay" aria-label={external ? `${link.label}（新窗口打开）` : link.label}>
                <Icon size={17} />
              </a>
            );
          })}
          {showLocalAdmin ? <a href="/admin/knowledge" className="ml-2 font-sans text-xs font-bold text-muted underline decoration-line underline-offset-4 hover:text-ink">本地资料审核</a> : null}
          <a href="#home" className="ml-2 inline-flex items-center gap-1 font-sans text-xs font-bold text-muted hover:text-ink">回到顶部 <ArrowUpRight size={14} /></a>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const [toast, setToast] = useState({ message: "", success: false });
  const toastTimer = useRef(null);

  useEffect(() => {
    document.title = portfolioData.site.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", portfolioData.site.description);

    const nodes = document.querySelectorAll("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.08 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const showToast = (message, success = false) => {
    window.clearTimeout(toastTimer.current);
    setToast({ message, success });
    toastTimer.current = window.setTimeout(() => setToast({ message: "", success: false }), 4200);
  };

  const hasContact = Boolean(portfolioData.profile.email || portfolioData.contact.socialLinks.length);

  return (
    <>
      <a href="#main-content" className="skip-link">跳至主要内容</a>
      <Header />
      <main id="main-content">
        <Hero />
        <About />
        {portfolioData.projects.items.length ? <Projects /> : null}
        <Journey />
        <AmaChat />
        {hasContact ? <Contact showToast={showToast} /> : null}
      </main>
      <Footer />

      <div className={`fixed bottom-5 left-1/2 z-[80] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 font-sans text-sm font-semibold shadow-float transition-all duration-300 ${toast.message ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"} ${toast.success ? "bg-sage text-white" : "bg-ink text-white"}`} role="status" aria-live="polite">
        {toast.success ? <Check size={17} /> : <CircleAlert size={17} />}
        <span>{toast.message}</span>
      </div>
    </>
  );
}
