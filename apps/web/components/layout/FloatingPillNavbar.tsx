"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useMotionTemplate, useMotionValue, useScroll, useSpring, useTransform, useReducedMotion } from "motion/react";
import { ArrowUpRight, Building2, CarFront, ChevronDown, Menu, X } from "lucide-react";
import { ThemeToggle } from "./ThemeProvider";
import { Brand } from "./Brand";
const links = [{ label: "Overview", href: "/#about" }, { label: "The platform", href: "/#platform" }, { label: "The brand", href: "/#how-it-works" }, { label: "Connect", href: "/#connect" }];
export function FloatingPillNavbar() {
  const [open, setOpen] = useState<"portal" | "mobile" | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [section, setSection] = useState("/#about");
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const { scrollY, scrollYProgress } = useScroll();
  const y = useSpring(useTransform(scrollY, [0, 150], [0, -8]), { stiffness: 180, damping: 30 });
  const xLight = useMotionValue(50), yLight = useMotionValue(0);
  const reflection = useMotionTemplate`radial-gradient(220px circle at ${xLight}px ${yLight}px, rgba(255,255,255,.12), transparent 75%)`;
  useEffect(() => {
    let frame=0;
    const update=()=>{frame=0;const checkpoint=window.innerHeight*.35;let current=links[0].href;for(const link of links){const el=document.getElementById(link.href.split("#")[1]);if(el&&el.getBoundingClientRect().top<=checkpoint)current=link.href;}if(window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-8)current="/#connect";setSection(current);};
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
    update();window.addEventListener("scroll",schedule,{passive:true});window.addEventListener("resize",schedule);window.addEventListener("hashchange",schedule);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener("scroll",schedule);window.removeEventListener("resize",schedule);window.removeEventListener("hashchange",schedule);};
  }, []);
  useEffect(() => {
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(null); };
    const keyboard = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(null); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", keyboard); };
  }, []);
  useEffect(() => {
    if (open) root.current?.querySelector<HTMLAnchorElement>(".nav-panel a")?.focus();
  }, [open]);
  return <header className="floating-header"><motion.div ref={root} style={{ y: reduced ? 0 : y }} className="nav-wrap" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(null); }}>
    <nav aria-label="Main navigation" className="glass-nav" onPointerMove={e => { const r = e.currentTarget.getBoundingClientRect(); xLight.set(e.clientX - r.left); yLight.set(e.clientY - r.top); }}>
      <motion.div className="nav-reflection" aria-hidden="true" style={{ background: reflection }}/><Brand light/>
      <div className="desktop-links" onMouseLeave={() => setActive(null)}>{links.map(link => <Link key={link.href} href={link.href} aria-current={section===link.href?"location":undefined} className={section===link.href?"nav-section-active":""} onClick={() => setOpen(null)} onMouseEnter={() => setActive(link.href)} onFocus={() => setActive(link.href)} onBlur={() => setActive(null)}>{(active ?? section) === link.href && <motion.span className="nav-hover" layoutId="nav-hover" transition={{ type: "spring", stiffness: 380, damping: 32 }}/>}<span>{link.label}</span></Link>)}</div>
      <div className="nav-actions"><ThemeToggle/><button ref={trigger} className="nav-login" aria-expanded={open === "portal"} aria-controls="portal-panel" onClick={() => setOpen(open === "portal" ? null : "portal")}>Sign in <ChevronDown size={14} className={open === "portal" ? "rotated" : ""}/></button><button className="mobile-menu" aria-label={open === "mobile" ? "Close navigation" : "Open navigation"} aria-expanded={open === "mobile"} aria-controls="mobile-panel" onClick={() => setOpen(open === "mobile" ? null : "mobile")}>{open === "mobile" ? <X size={20}/> : <Menu size={20}/>}</button></div>
    <motion.div className="nav-reading-progress" style={{scaleX:scrollYProgress}} aria-hidden="true"/></nav>{open && <div key={open} id={open === "portal" ? "portal-panel" : "mobile-panel"} className="nav-panel slide-enter">
      {open === "mobile" && links.map(link => <Link href={link.href} key={link.href} aria-current={section===link.href?"location":undefined} onClick={() => setOpen(null)}>{link.label}<ArrowUpRight size={16}/></Link>)}
      <span className="nav-panel-label">YOUR WORKSPACE</span><Link href="/login/government" onClick={() => setOpen(null)}><Building2 size={19}/><span>Government portal<small>For invited RTO personnel</small></span><ArrowUpRight size={16}/></Link><Link href="/login/owner" onClick={() => setOpen(null)}><CarFront size={19}/><span>Vehicle owner<small>Your vehicles. Your peace of mind.</small></span><ArrowUpRight size={16}/></Link>
    </div>}
  </motion.div></header>;
}
