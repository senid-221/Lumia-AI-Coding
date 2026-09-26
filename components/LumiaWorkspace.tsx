"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Settings, X, Menu, ChevronDown, Bot, Loader2 } from "lucide-react";

type Msg = { role:"user"|"assistant"; content:string };
type MenuState = "none"|"main"|"lumia"|"agent"|"provider"|"model"|"settings";
const providers=["OpenAI","Anthropic","Google"];
const models=["gpt-5.5","Sonnet 4.5","Gemini"];

export default function LumiaWorkspace({ accountControl }: { accountControl: React.ReactNode }) {
  const [task,setTask] = useState("");
  const [messages,setMessages] = useState<Msg[]>([]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [conversationId,setConversationId] = useState<string>();
  const [menu,setMenu] = useState<MenuState>("none");
  const [provider,setProvider] = useState("OpenAI");
  const [model,setModel] = useState("gpt-5.5");
  const [skipInstall,setSkipInstall] = useState(false);
  const [timerOn,setTimerOn] = useState(true);
  const rootRef=useRef<HTMLElement>(null);

  useEffect(()=>{
    const close=(e:MouseEvent)=>{ if(rootRef.current && !rootRef.current.contains(e.target as Node)) setMenu("none"); };
    document.addEventListener("mousedown",close);
    return()=>document.removeEventListener("mousedown",close);
  },[]);

  async function send() {
    const value = task.trim();
    if (!value || busy) return;
    setTask(""); setError(""); setMessages(m=>[...m,{role:"user",content:value}]); setBusy(true);
    try {
      const res = await fetch("/api/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task:value,conversationId,provider:provider.toLowerCase(),model})});
      if (!res.ok || !res.body) throw new Error((await res.json().catch(()=>({}))).error || "Request failed");
      const reader = res.body.getReader(), decoder = new TextDecoder();
      let assistant = "";
      setMessages(m=>[...m,{role:"assistant",content:""}]);
      while (true) {
        const {value:chunk,done}=await reader.read(); if(done) break;
        const text=decoder.decode(chunk,{stream:true});
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data=line.slice(6); if(data==="[DONE]") continue;
          const event=JSON.parse(data);
          if(event.type==="conversation") setConversationId(event.id);
          if(event.type==="delta"){ assistant += event.text; setMessages(m=>{const copy=[...m]; copy[copy.length-1]={role:"assistant",content:assistant}; return copy;}); }
          if(event.type==="error") setError(event.error);
        }
      }
    } catch(e) { setError(e instanceof Error?e.message:"Something went wrong"); }
    finally { setBusy(false); }
  }

  const popup=(title:string,items:string[],onPick:(v:string)=>void)=><div className="menu-popover"><div className="menu-title">{title}</div>{items.map(item=><button className="menu-item" key={item} onClick={()=>{onPick(item);setMenu("none")}}>{item}</button>)}</div>;

  return <main className="workspace" ref={rootRef}>
    <header className="topbar">
      <div className="top-left"><button className="icon-btn" onClick={()=>setMenu(menu==="main"?"none":"main")} aria-label="Open menu"><Menu size={18}/></button><button className="selector" onClick={()=>setMenu(menu==="lumia"?"none":"lumia")}><Bot size={15}/><span>lumia</span><ChevronDown size={13}/></button><span className="slash">/</span><button className="selector" onClick={()=>setMenu(menu==="agent"?"none":"agent")}><span>ai-agent</span><ChevronDown size={13}/></button></div>
      <div className="top-right">{accountControl}<button className="dots" onClick={()=>setMenu(menu==="main"?"none":"main")}>•••</button></div>{menu==="main"&&popup("Menu",["New task","Settings"],v=>{if(v==="New task"){setMessages([]);setConversationId(undefined)}else setMenu("settings")})}{menu==="lumia"&&popup("Workspace",["lumia"],()=>{})}{menu==="agent"&&popup("Agent",["ai-agent"],()=>{})}
    </header>
    <section className="hero">
      <div className="robot-glow"><div className="robot"><Bot size={54}/></div></div>
      <h1>Lumia AI Agent</h1>
      <p>Multi-agent AI coding platform powered by <a href="#">BeeLimited</a> and <a href="#">RwaCodex</a>.</p>
    </section>
    {messages.length>0 && <section className="chat-feed">{messages.map((m,i)=><div className={"message "+m.role} key={i}><div className="message-role">{m.role==="user"?"You":"Lumia"}</div><div className="message-content">{m.content || (busy && <Loader2 className="spin" size={16}/>)}</div></div>)}</section>}
    {error && <div className="error-banner">{error}</div>}
    <section className="composer">
      <textarea value={task} onChange={e=>setTask(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Describe what you want the AI agent to do..." rows={4}/>
      <div className="composer-footer">
        <div className="composer-left"><button className="pill" onClick={()=>setMenu(menu==="provider"?"none":"provider")}>{provider} <ChevronDown size={12}/></button><button className="pill" onClick={()=>setMenu(menu==="model"?"none":"model")}>{model} <ChevronDown size={12}/></button><button className="pill muted" onClick={()=>setSkipInstall(v=>!v)}>Skip Install {skipInstall?"✓":""}{!skipInstall&&<X size={12}/>}</button><button className="pill muted" onClick={()=>setTimerOn(v=>!v)}>{timerOn?"10m":"Timer off"} {timerOn&&<X size={12}/>}</button></div>
        <div className="composer-actions"><button className="icon-btn" onClick={()=>setMenu(menu==="settings"?"none":"settings")}><Settings size={17}/></button><button className="send-btn" onClick={send} disabled={busy||!task.trim()} aria-label="Send"><Send size={17}/></button></div>
      </div>{menu==="provider"&&popup("Agent provider",providers,v=>setProvider(v))}{menu==="model"&&popup("Agent model",models,v=>setModel(v))}{menu==="settings"&&<div className="menu-popover settings-popover"><div className="menu-title">Lumia settings</div><button className="menu-item" onClick={()=>{setSkipInstall(false);setTimerOn(true);setMenu("none")}}>Reset controls</button><div className="menu-note">Provider: {provider} · Model: {model}</div></div>}
    </section>
  </main>;
}