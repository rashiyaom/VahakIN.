"use client";
import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function useHomeReveals(root:RefObject<HTMLDivElement|null>){useEffect(()=>{
 gsap.registerPlugin(ScrollTrigger);
 const media=gsap.matchMedia();
 media.add("(prefers-reduced-motion: no-preference)",()=>{
  const element=root.current!;
  gsap.fromTo(element.querySelectorAll(".hero-copy .eyebrow, .hero-copy h1, .hero-copy p, .hero-buttons, .hero-bottom"),
    {y:28,opacity:0},{y:0,opacity:1,duration:1.1,stagger:.12,ease:"power3.out",clearProps:"transform,opacity"});
  element.querySelectorAll<HTMLElement>("[data-reveal], .people-copy, .people-visual, .faq-list details, .cta-section").forEach(item=>{
   gsap.fromTo(item,{y:48,opacity:0},{y:0,opacity:1,duration:1,ease:"power3.out",clearProps:"transform,opacity",scrollTrigger:{trigger:item,start:"top 94%",once:true}});
  });
  element.querySelectorAll<HTMLElement>(".stat-grid, .solutions-grid, .audience-links").forEach(group=>{
    const cards=group.querySelectorAll(".stat-card, .stat-image, .solution-card, a");
    // Select only direct cards: links inside a card must not be animated twice.
    const direct=Array.from(cards).filter(card=>card.parentElement===group);
    if(window.matchMedia("(max-width:760px)").matches){
      direct.forEach((card,i)=>gsap.fromTo(card,{y:55,x:i%2?14:-14,opacity:0},{y:0,x:0,opacity:1,duration:.9,ease:"power3.out",clearProps:"transform,opacity",scrollTrigger:{trigger:card,start:"top 94%",once:true}}));
    }else{
      gsap.fromTo(direct,{y:80,x:i=>i%2?22:-22,rotation:i=>i%2?2:-2,opacity:0},
        {y:0,x:0,rotation:0,opacity:1,duration:1.1,stagger:.13,ease:"power3.out",clearProps:"transform,opacity",scrollTrigger:{trigger:group,start:"top 90%",once:true}});
    }
  });
  const hero=element.querySelector(".hero-image");
  if(hero)gsap.to(hero,{yPercent:12,scale:1.08,ease:"none",scrollTrigger:{trigger:element.querySelector(".home-hero"),start:"top top",end:"bottom top",scrub:true}});
  gsap.to(element.querySelector(".hero-orbits"),{rotation:32,yPercent:20,ease:"none",scrollTrigger:{trigger:element.querySelector(".home-hero"),start:"top top",end:"bottom top",scrub:1}});
 });
 return()=>media.revert();
},[root]);}
