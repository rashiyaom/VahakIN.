import { cookieName } from "@/lib/server/session";
import { NextResponse } from "next/server";
import { authClient } from "@/lib/supabase/server";
import { liveAccount } from "@/lib/server/live-store";
import { portalFor } from "@/lib/permissions/access";
export async function GET(request:Request){
 const url=new URL(request.url),client=await authClient(),code=url.searchParams.get("code"),hash=url.searchParams.get("token_hash"),type=url.searchParams.get("type");
 let success=false;
 if(code){const {error}=await client.auth.exchangeCodeForSession(code);success=!error;}
 else if(hash&&(type==="signup"||type==="recovery"||type==="email")){const {error}=await client.auth.verifyOtp({token_hash:hash,type});success=!error;}
 if(!success)return NextResponse.redirect(new URL("/login/owner?confirmation=expired",url.origin));
 const redirectTo=(path:string)=>{const response=NextResponse.redirect(new URL(path,url.origin));response.cookies.delete(cookieName);return response;};
 if(url.searchParams.get("next")==="/auth/reset-password"||type==="recovery")return redirectTo("/auth/reset-password");
 const {data}=await client.auth.getUser(),account=data.user?await liveAccount(data.user.id):null;
 return redirectTo(account?`/${portalFor(account)}`:"/login/owner");
}
