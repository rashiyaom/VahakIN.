import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createSession, cookieName, currentAccount, sameOrigin, tokenHash } from "./session";
import { demoEnabled, withStoreTransaction } from "./demo-store";
import { createApplicant } from "./enrollment";
import { portalFor } from "../permissions/access";
import { authClient, supabaseConfigured } from "../supabase/server";
import { accountStore, limitAttempts, liveAccount } from "./live-store";
const fail=(error:string,status=400)=>NextResponse.json({error},{status});
const schema=z.object({action:z.enum(["signin","signup","recover","update-password"]).default("signin"),email:z.email().max(254).optional(),password:z.string().min(8).max(128).optional(),fullName:z.string().trim().min(2).max(100).optional(),portal:z.enum(["owner","government"]).default("owner")}).strict();
async function destination(account:NonNullable<Awaited<ReturnType<typeof currentAccount>>>){return account.role==="vehicle_owner"&&!(await accountStore(account)).vehicles.some(v=>v.ownerId===account.id&&v.ownerVerified)?"/owner/onboarding":`/${portalFor(account)}`;}
export async function POST(request:Request){
 if(!sameOrigin(request))return fail("Invalid request origin.",403);
 try{
  const raw=await request.text();if(raw.length>4096)return fail("Request is too large.",413);
  const input=JSON.parse(raw);
  if(input?.mode==="demo"||input?.mode==="new-owner"){
   const existing=await currentAccount();if(existing?.mode!=="demo")return fail("Sign in with the demonstration account first.",403);
   const id=input.mode==="new-owner"?withStoreTransaction(s=>createApplicant(s).id):String(input.accountId);
   const session=createSession(id);if(!session)return fail("Workspace unavailable.");
   const response=NextResponse.json({redirect:await destination({...session.account,mode:"demo"})});response.cookies.set(cookieName,session.token,{httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production",path:"/",maxAge:14400});return response;
  }
  const parsed=schema.safeParse(input);if(!parsed.success)return fail("Check your email and password (at least 8 characters).");
  const form=parsed.data,email=form.email?.trim().toLowerCase();
  if(form.action!=="update-password"&&!email)return fail("Enter your email address.");
  if(form.action==="signin"&&demoEnabled()&&email===process.env.VAHAKIN_DEMO_EMAIL?.toLowerCase()){
   const allowed=withStoreTransaction(store=>{const attempts=(store.enrollment??={applications:[],devices:[],claimAttempts:{}}).claimAttempts;const key="demo-login";if(!attempts[key]||attempts[key].until<Date.now())attempts[key]={count:0,until:Date.now()+900000};return ++attempts[key].count<=60;});
   if(!allowed)return fail("Too many attempts. Please try again in 15 minutes.",429);
   const expected=process.env.VAHAKIN_DEMO_PASSWORD_SHA256??"",actual=tokenHash(form.password??"");
   if(expected.length!==actual.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(actual)))return fail("Email or password is incorrect.",401);
   if(supabaseConfigured())await (await authClient()).auth.signOut({scope:"local"});
   const session=createSession(form.portal==="government"?"demo-rto":"demo-owner")!;
   const response=NextResponse.json({redirect:`/${portalFor(session.account)}`});response.cookies.set(cookieName,session.token,{httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production",path:"/",maxAge:14400});return response;
  }
  if(!supabaseConfigured())return fail("Account service is not configured.",503);
  if(supabaseConfigured()&&!await limitAttempts(`auth:${tokenHash(email??"password-update")}`,12,900))return fail("Too many attempts. Please try again in 15 minutes.",429);

  const client=await authClient(),origin=new URL(request.url).origin;
  if(form.action==="recover"){
   const {error}=await client.auth.resetPasswordForEmail(email!,{redirectTo:`${origin}/auth/callback?next=/auth/reset-password`});
   if(error)return fail("Unable to send a reset email right now. Please try again later.");
   return NextResponse.json({message:"If an account exists for this address, a password reset email will arrive shortly."});
  }
  if(!form.password)return fail("Enter your password.");
  if(form.action==="update-password"){
   const {data}=await client.auth.getUser();if(!data.user)return fail("Open the reset link in your email first.",401);
   const {error}=await client.auth.updateUser({password:form.password});if(error)return fail("Unable to update the password. Request a new reset link.");
   await client.auth.signOut({scope:"local"});return NextResponse.json({redirect:"/login/owner"});
  }
  if(form.action==="signup"){
   if(form.portal!=="owner")return fail("Government access is assigned by your administrator.",403);
   if(!form.fullName)return fail("Enter your full name.");
   if(email===process.env.VAHAKIN_DEMO_EMAIL?.toLowerCase())return fail("This address is reserved. Use your own email.");
   const {error}=await client.auth.signUp({email:email!,password:form.password,options:{data:{full_name:form.fullName},emailRedirectTo:`${origin}/auth/callback`}});
   if(error)return fail(error.status===429?"Email limit reached. Please wait before requesting another confirmation.":"Unable to create this account. Try signing in or resetting your password.");
   return NextResponse.json({message:"Check your email to confirm your account, then sign in to start your device setup."});
  }
  const {data,error}=await client.auth.signInWithPassword({email:email!,password:form.password});
  if(error||!data.user)return fail(error?.code==="email_not_confirmed"?"Please confirm your email before signing in.":"Email or password is incorrect.",401);
  const account=await liveAccount(data.user.id);
  if(!account||!data.user.email_confirmed_at){await client.auth.signOut({scope:"local"});return fail("Your account is not active or your email is not confirmed.",403);}
  const response=NextResponse.json({redirect:await destination(account)});response.cookies.delete(cookieName);return response;
 }catch{return fail("Unable to reach the account service. Please try again.",503);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return fail("Invalid request origin.",403);
 const token=(await cookies()).get(cookieName)?.value;
 if(token&&demoEnabled())withStoreTransaction(store=>{store.sessions=store.sessions.filter(s=>s.hash!==tokenHash(token));});
 if(supabaseConfigured())await (await authClient()).auth.signOut({scope:"local"});
 const response=NextResponse.json({ok:true});response.cookies.delete(cookieName);return response;
}
