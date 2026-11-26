"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/** Native sticky staging keeps scroll and anchor navigation under the user's control. */
export function ScrollStory() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const element = root.current!;
      const timeline = gsap.timeline({scrollTrigger:{trigger:element,start:"top 80%",end:"bottom 15%",scrub:1}});
      timeline.fromTo(element.querySelector(".brand-reveal-lockup"),
        {y:95,scale:.72},{y:0,scale:1,duration:.45,ease:"power2.out"},0)
        .fromTo(element.querySelector(".brand-reveal-mark"),
          {rotation:-32,opacity:.3},{rotation:0,opacity:1,duration:.4,ease:"power2.out"},0)
        .fromTo(element.querySelector("h2"),
          {backgroundPosition:"130% 50%"},{backgroundPosition:"-40% 50%",duration:1,ease:"none"},0)
        .fromTo(element.querySelector(".brand-halo"),
          {scale:.65,rotation:-28,opacity:.2},{scale:1.25,rotation:18,opacity:.8,duration:1,ease:"none"},0)
        .fromTo(element.querySelector(".brand-horizon"),
          {scaleX:.25,opacity:.2},{scaleX:1.3,opacity:.85,duration:.7,ease:"power2.out"},.15);
    });
    return () => media.revert();
  }, []);

  return <section id="how-it-works" ref={root} className="brand-interlude" aria-labelledby="brand-reveal-heading">
    <div className="brand-reveal-stage">
      <div className="brand-halo" aria-hidden="true"><i/><i/><i/></div>
      <div className="brand-starfield" aria-hidden="true"/>
      <div className="brand-horizon" aria-hidden="true"/>
      <div className="brand-reveal-lockup">
        <svg className="brand-reveal-mark" viewBox="0 0 160 160" fill="none" aria-hidden="true">
          <defs><linearGradient id="brand-silver" x1="15" y1="20" x2="140" y2="145" gradientUnits="userSpaceOnUse"><stop stopColor="#fff"/><stop offset=".45" stopColor="#b5d6ca"/><stop offset=".65" stopColor="#fff"/><stop offset="1" stopColor="#6d9a8b"/></linearGradient></defs>
          <ellipse cx="80" cy="80" rx="69" ry="29" transform="rotate(-32 80 80)" stroke="url(#brand-silver)" strokeWidth="3"/>
          <circle cx="80" cy="80" r="30" fill="url(#brand-silver)"/>
        </svg>
        <h2 id="brand-reveal-heading">VahakIN<span>.</span></h2>
      </div>
    </div>
  </section>;
}
