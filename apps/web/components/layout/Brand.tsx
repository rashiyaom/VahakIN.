import Link from "next/link";
export function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" aria-label="VahakIN home" className={`brand ${light ? "brand-light" : ""}`}><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><ellipse cx="16" cy="16" rx="14" ry="6" transform="rotate(-32 16 16)" stroke="currentColor" strokeWidth="2.5"/><circle cx="16" cy="16" r="6.5" fill="currentColor"/></svg><span>VahakIN<span className="brand-dot">.</span></span></Link>;
}
