import type { ReactNode } from "react";
import { CheckCheck, type LucideIcon } from "lucide-react";
export function Badge({children}:{children:ReactNode}){const text=String(children).toLowerCase();const tone=/critical|outside|suspected|review required|high/.test(text)?"red":/unverified|inactive|expired|not verified|stale|pending|medium|under review|unknown|unavailable|offline|low|assigned/.test(text)?"amber":/active|current|online|inside|secure|verified|stationary|acknowledged/.test(text)?"green":"neutral";return <span className={`badge ${tone}`}><i/>{children}</span>;}
export function Empty({title="Nothing here yet",text="Records will appear here when activity is available within your authorized scope."}:{title?:string;text?:string}){return <div className="empty-state"><CheckCheck size={28}/><h3>{title}</h3><p>{text}</p></div>;}
export function Field({label,children}:{label:string;children:ReactNode}){return <div className="detail-field"><dt>{label}</dt><dd>{children??"Unavailable"}</dd></div>;}

export function SectionHeader({title,sub,children}:{title:string;sub?:string;children?:ReactNode}){return <div className="panel-heading"><div><h2>{title}</h2>{sub&&<p>{sub}</p>}</div>{children}</div>;}

export type DashboardMetric = { label: string; value: ReactNode; note: string; icon: LucideIcon };
export function SummaryMetrics({items}:{items:DashboardMetric[]}) { return <div className="metrics-grid">{items.map((m,i)=><article className={`metric-card ${i===2?"featured":""}`} key={m.label}><div><span>{m.label}</span><m.icon size={18}/></div><strong>{m.value}</strong><p>{m.note}</p></article>)}</div>; }
