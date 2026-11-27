"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import "@tavus/embed";
import {TavusIntegration} from "@tavus/embed";
import type {Account} from "@/lib/permissions/access";
import {roleNames} from "@/lib/permissions/access";
import type {WorkspaceData} from "@/lib/server/workspace";
import {buildVahanAiContext,getVahanGreeting} from "@/lib/ai/vahan-context";
import {ChartVisualizer,type ChartSpec} from "./ChartVisualizer";
const DEPLOYMENT_ID="a4952ff4-3aad-400e-9da2-a9e27bda133a";
export function VahanAiWorkspace({account,data}:{account:Account;data:WorkspaceData}){
 const integration=useRef<TavusIntegration|null>(null);
 const [live,setLive]=useState(false),[notice,setNotice]=useState("Start a conversation when you’re ready.");
 const context=useMemo(()=>buildVahanAiContext(account,data),[account,data]);
 useEffect(()=>{
  const api=new TavusIntegration("tavus-embed");integration.current=api;
  const started=()=>{setLive(true);setNotice("Conversation connected.");};
  const ended=()=>{setLive(false);setNotice("Conversation ended.");};
  const error=(e:CustomEvent<{code:string;message:string}>)=>{setLive(false);setNotice(e.detail.message||"Unable to connect. Please try again in the conversation panel.");};
  const mode=(e:CustomEvent<{mode:string}>)=>{if(e.detail.mode==="unavailable"){setLive(false);setNotice("The assistant is currently unavailable. Please try later.");}};
  api.on("tavus:conversation-started",started);api.on("tavus:conversation-ended",ended);api.on("tavus:error",error);api.on("tavus:mode-change",mode);
  return ()=>{api.off("tavus:conversation-started",started);api.off("tavus:conversation-ended",ended);api.off("tavus:error",error);api.off("tavus:mode-change",mode);integration.current=null;};
 },[]);
 useEffect(()=>{if(live)integration.current?.sendMessage({event_type:"conversation.overwrite_llm_context",properties:{context}});},[context,live]);
 const chart:ChartSpec={chart_type:"bar",title:"Monitoring overview",description:"Latest available records in your workspace. Review flags may overlap monitoring categories.",data:[{label:"Current",value:data.summary.current},{label:"Stale",value:data.summary.stale},{label:"Unavailable",value:data.summary.unavailable},{label:"Review required",value:data.summary.review}]};
 return <div className="vahan-ai-workspace">
  <div className="vahan-identity-strip"><span>{roleNames[account.role]} · {account.name}</span><span role="status">{notice}</span></div>
  <section className="vahan-embed-card"><div className="vahan-embed-topbar"><strong>VAHAN AI · Your VahakIN assistant</strong></div>
   <p>Discuss the records in your workspace. Starting a conversation shares the displayed record summary with Tavus. This assistant cannot change records or make official decisions.</p>
   <div className="vahan-embed-viewport">{DEPLOYMENT_ID?<tavus-embed key={`${account.id}-${account.role}`} deployment-id={DEPLOYMENT_ID} conversational-context={context} custom-greeting={getVahanGreeting(account)} memory-stores={`${DEPLOYMENT_ID}-${account.mode}-${account.id}-${account.role}`} layout="inline" camera-on-start="off"/>:<p>The assistant is not configured yet.</p>}</div>
   <div className="vahan-prompts-bar">{["Explain my monitoring overview","What does stale telemetry mean?","Explain the next review step"].map(prompt=><button key={prompt} type="button" className="vahan-chip-btn" disabled={!live} onClick={()=>integration.current?.sendMessage(prompt)}>{prompt}</button>)}</div>
  </section><ChartVisualizer chart={chart}/>
 </div>;
}
