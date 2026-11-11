"use client";

import { useEffect, useRef } from "react";

export default function Reveal({ children, className = "", delay = 0 }) {
  const element = useRef(null);

  useEffect(() => {
    const target = element.current;
    if (!target || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        target.dataset.visible = "true";
        observer.unobserve(target);
      }
    }, { threshold: 0.12 });
    target.dataset.visible = "false";
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return <div ref={element} className={`reveal ${className}`} style={{ "--reveal-delay": `${delay}ms` }}>{children}</div>;
}
