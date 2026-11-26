"use client";
import { useState, useEffect, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { Brand } from "@/components/layout/Brand";
export function SplitLoginCard({portal,reset=false}:{portal:"government"|"owner";reset?:boolean}){
 const owner=portal==="owner";
 const [action,setAction]=useState<"signin"|"signup"|"recover"|"update-password">(reset?"update-password":"signin");
 const [show,setShow]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[isError,setIsError]=useState(false);
 useEffect(()=>{if(new URLSearchParams(window.location.search).get("confirmation")==="expired"){setMessage("This email link has expired or was already used. Sign in, or request a new confirmation by creating your account again.");setIsError(true);}},[]);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setMessage("");setIsError(false);const values=new FormData(e.currentTarget);
  try{const payload={action,portal,...Object.fromEntries(values.entries())};const response=await fetch("/api/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error);if(result.redirect)window.location.assign(result.redirect);else{setMessage(result.message);setBusy(false);}}catch(e){setMessage(e instanceof Error?e.message:"Unable to sign in. Please try again.");setIsError(true);setBusy(false);}}
 function change(next:typeof action){setAction(next);setMessage("");setIsError(false);}
 return <div className="login-scene"><div className="login-backdrop" aria-hidden="true"><Image src="/images/homepage.png" alt="" fill priority sizes="100vw"/></div><main className="login-card">
 <div className="login-art"><Image src="/images/homepage.png" alt="Illustrated transport campus framed by trees, with commercial vehicles at rest" fill priority sizes="(max-width: 760px) 100vw, 450px"/><div className="login-art-copy"><p>STILL. CONNECTED.</p><h2>At rest.<br/>In good hands.</h2><span>Thoughtful monitoring. Shared confidence.</span></div></div>
 <div className="login-form-side"><div><Link href="/" className="login-back"><ArrowLeft size={13}/> Back to home</Link><div className="login-title"><p>{action==="signup"?"A simple start. A shared connection.":action==="recover"?"Let’s get you back in.":owner?"Your vehicle. Your peace of mind.":"Welcome to your workspace"}</p><h1>{action==="signup"?<>Your first step<br/>to peace of mind.</>:action==="recover"?<>Forgot your<br/>password?</>:action==="update-password"?<>A fresh start.<br/>A new password.</>:owner?<>A little closer to<br/>what matters.</>:<>Where clarity<br/>meets confidence.</>}</h1></div>
 <form className="login-form" onSubmit={submit}>
 {action==="signup"&&<div><label htmlFor="fullName">Full name</label><input id="fullName" name="fullName" autoComplete="name" required minLength={2} maxLength={100} placeholder="Your full name"/></div>}
 {action!=="update-password"&&<div><label htmlFor="identifier">{owner?"Email address":"Official email address"}</label><input id="identifier" name="email" type="email" autoComplete="email" placeholder={owner?"you@example.com":"you@department.gov.in"} required maxLength={254}/></div>}
 {action!=="recover"&&<div><label htmlFor="password">{action==="update-password"?"New password":"Password"}</label><div className="password-wrap"><input id="password" type={show?"text":"password"} name="password" autoComplete={action==="signin"?"current-password":"new-password"} placeholder="At least 8 characters" minLength={8} maxLength={128} required/><button type="button" aria-label={show?"Hide password":"Show password"} onClick={()=>setShow(!show)}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></div>}
 <button className="button button-dark" type="submit" disabled={busy}>{busy&&<Loader2 size={16} className="animate-spin"/>}{action==="signup"?"Create your account":action==="recover"?"Send reset link":action==="update-password"?"Save new password":"Sign in to your workspace"}</button>
 {message&&<p role={isError?"alert":"status"} className={`form-message ${isError?"form-error":""}`}>{message}</p>}
 </form><div className="login-assistance">{action==="signin"?<><span>{owner?"New to VahakIN?":"Government accounts are assigned by your administrator."} {owner&&<button onClick={()=>change("signup")}>Create an account</button>}</span><button onClick={()=>change("recover")}>Forgot password?</button></>:<button onClick={()=>change("signin")}>Back to sign in</button>}</div>
 {!reset&&<p className="login-source">{owner?"RTO official?":"Vehicle owner?"} <Link href={owner?"/login/government":"/login/owner"}>{owner?"Government sign-in":"Owner sign-in"}</Link></p>}
 {action==="signup"&&<p className="login-source">Confirm your email, then connect your device. Your progress is saved as you go.</p>}
 </div><div className="login-brand-lockup"><Brand/><p>Declared Non Use.<br/>Verified Compliance.</p></div></div></main></div>;
}
