"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Settings, X, Menu, ChevronDown, Bot, Loader2, LayoutGrid, History, Plug, Rocket, FolderPlus, MessageSquarePlus, BookOpen, UserRound } from "lucide-react";

type Msg = { role:"user"|"assistant"; content:string };
type MenuState = "none"|"main"|"lumia"|"agent"|"provider"|"model"|"settings";
type MainAction = "new"|"services"|"history"|"settings"|"connectors"|"deploy"|"projects"|"docs"|"account";
const agents=[
  "ai-agent","coding-agent","unit-test","ask","e2e-test","repo-info","web-dev",
  "planner","coder","reviewer","debugger","verifier","hacking-lab"
];
const providerModels: Record<string,string[]> = {
  Anthropic:["Haiku 4.5","Sonnet 4.6","Opus 4.6","Opus 4.7"],
  OpenAI:["GPT-5.3 Codex","GPT-5.4","GPT-5.4-mini","GPT-5.5"],
  Google:["Gemini Pro 3.1","Gemini Flash 3.0"],
  xAI:["Grok Code Fast 1"],
  Zencoder:["Auto","Auto+"]
};
const providers=Object.keys(providerModels);

export default function LumiaWorkspace({ accountControl }: { accountControl: React.ReactNode }) {
  const [task,setTask] = useState("");
  const [messages,setMessages] = useState<Msg[]>([]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [conversationId,setConversationId] = useState<string>();
  const [menu,setMenu] = useState<MenuState>("none");
  const [agent,setAgent] = useState("ai-agent");
  const [provider,setProvider] = useState("OpenAI");
  const [model,setModel] = useState("GPT-5.5");
  const [skipInstall,setSkipInstall] = useState(false);
  const [timerOn,setTimerOn] = useState(true);
  const [notice,setNotice] = useState("");
  const rootRef=useRef<HTMLElement>(null);
  const models=providerModels[provider] || [];

  useEffect(()=>{
    const close=(e:MouseEvent)=>{ if(rootRef.current && !rootRef.current.contains(e.target as Node)) setMenu("none"); };
    document.addEventListener("mousedown",close);
    return()=>document.removeEventListener("mousedown",close);
  },[]);

  useEffect(()=>{ if(!models.includes(model)) setModel(models[0] || "Auto"); },[provider]);

  async function send() {
    const value = task.trim();
    if (!value || busy) return;
    setTask(""); setError(""); setMessages(m=>[...m,{role:"user",content:value}]); setBusy(true);
    try {
      const res = await fetch("/api/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task:value,conversationId,agent,provider:provider.toLowerCase().replace("zencoder","zencode"),model})});
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
          if(event.type==="message"){ assistant = event.text || assistant; setMessages(m=>{const copy=[...m]; copy[copy.length-1]={role:"assistant",content:assistant}; return copy;}); }
          if(event.type==="specialist_start"){ setMessages(m=>{const copy=[...m]; const current=copy[copy.length-1]; if(current?.role==="assistant" && !current.content) copy[copy.length-1]={role:"assistant",content:"Lumia "+event.name+" is working..."}; return copy;}); }
          if(event.type==="error") setError(event.error);
        }
      }
    } catch(e) { setError(e instanceof Error?e.message:"Something went wrong"); }
    finally { setBusy(false); }
  }

  const mainMenu: {id:MainAction; label:string; icon:React.ReactNode}[] = [
    {id:"new",label:"New task",icon:<MessageSquarePlus size={15}/>},
    {id:"services",label:"All services",icon:<LayoutGrid size={15}/>},
    {id:"history",label:"History",icon:<History size={15}/>},
    {id:"projects",label:"Projects",icon:<FolderPlus size={15}/>},
    {id:"connectors",label:"Connectors",icon:<Plug size={15}/>},
    {id:"deploy",label:"Deploy",icon:<Rocket size={15}/>},
    {id:"docs",label:"Documentation",icon:<BookOpen size={15}/>},
    {id:"account",label:"Account",icon:<UserRound size={15}/>},
    {id:"settings",label:"Settings",icon:<Settings size={15}/>}
  ];

  function handleMainAction(action:MainAction){
    setMenu("none");
    if(action==="new"){setMessages([]);setConversationId(undefined);setTask("");return;}
    if(action==="settings"){setMenu("settings");return;}
    const notices: Record<string,string> = {
      services:"All Services — AI coding, agents, Hacking Lab, Git, reviews and automation.",
      history:"History — your previous Lumia conversations and agent runs.",
      projects:"Projects — manage your coding workspaces.",
      connectors:"Connectors — connect GitHub, Google, databases and external tools.",
      deploy:"Deploy — prepare this project for production deployment.",
      docs:"Documentation — Lumia AI Agent platform guides and services.",
      account:"Account — manage your Lumia profile and authentication."
    };
    setNotice(notices[action]);
    window.setTimeout(()=>setNotice(""),4500);
  }

  const popup=(title:string,items:string[],onPick:(v:string)=>void)=><div className="menu-popover"><div className="menu-title">{title}</div>{items.map(item=><button className="menu-item" key={item} onClick={()=>{onPick(item);setMenu("none")}}>{item}</button>)}</div>;

  return <main className="workspace" ref={rootRef}>
    <header className="topbar">
      <div className="top-left"><button className="icon-btn" onClick={()=>setMenu(menu==="main"?"none":"main")} aria-label="Open menu"><Menu size={18}/></button><button className="selector" onClick={()=>setMenu(menu==="lumia"?"none":"lumia")}><Bot size={15}/><span>lumia</span><ChevronDown size={13}/></button><span className="slash">/</span><button className="selector" onClick={()=>setMenu(menu==="agent"?"none":"agent")}><span>{agent}</span><ChevronDown size={13}/></button></div>
      <div className="top-right">{accountControl}<button className="dots" onClick={()=>setMenu(menu==="main"?"none":"main")}>•••</button></div>{menu==="main"&&<div className="menu-popover main-menu"><div className="menu-title">Lumia</div>{mainMenu.map(item=><button className="menu-item menu-action" key={item.id} onClick={()=>handleMainAction(item.id)}>{item.icon}<span>{item.label}</span>{item.id==="deploy"&&<span className="menu-shortcut">↗</span>}</button>)}</div>}{menu==="lumia"&&popup("Workspace",["lumia"],()=>{})}{menu==="agent"&&popup("Agent",agents,v=>setAgent(v))}
    </header>
    <section className="hero">
      <div className="robot-glow"><div className="robot"><Bot size={54}/></div></div>
      <h1>Lumia AI Agent</h1>
      <p>Multi-agent AI coding platform powered by <a href="#">BeeLimited</a> and <a href="#">RwaCodex</a>.</p>
    </section>
    {messages.length>0 && <section className="chat-feed">{messages.map((m,i)=><div className={"message "+m.role} key={i}><div className="message-role">{m.role==="user"?"You":"Lumia"}</div><div className="message-content">{m.content || (busy && <Loader2 className="spin" size={16}/>)}</div></div>)}</section>}
    {error && <div className="error-banner">{error}</div>}{notice && <div className="error-banner menu-notice">{notice}</div>}
    <section className="composer">
      <textarea value={task} onChange={e=>setTask(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Describe what you want the AI agent to do..." rows={4}/>
      <div className="composer-footer">
        <div className="composer-left"><button className="pill" onClick={()=>setMenu(menu==="provider"?"none":"provider")}>{provider} <ChevronDown size={12}/></button><button className="pill" onClick={()=>setMenu(menu==="model"?"none":"model")}>{model} <ChevronDown size={12}/></button><button className="pill muted" onClick={()=>setSkipInstall(v=>!v)}>Skip Install {skipInstall?"✓":""}{!skipInstall&&<X size={12}/>}</button><button className="pill muted" onClick={()=>setTimerOn(v=>!v)}>{timerOn?"10m":"Timer off"} {timerOn&&<X size={12}/>}</button></div>
        <div className="composer-actions"><button className="icon-btn" onClick={()=>setMenu(menu==="settings"?"none":"settings")}><Settings size={17}/></button><button className="send-btn" onClick={send} disabled={busy||!task.trim()} aria-label="Send"><Send size={17}/></button></div>
      </div>{menu==="provider"&&popup("Agent provider",providers,v=>setProvider(v))}{menu==="model"&&popup("Agent model",models,v=>setModel(v))}{menu==="settings"&&<div className="menu-popover settings-popover"><div className="menu-title">Lumia settings</div><button className="menu-item" onClick={()=>{setSkipInstall(false);setTimerOn(true);setMenu("none")}}>Reset controls</button><div className="menu-note">Agent: {agent==="hacking-lab"?"Lumia Hacking Lab Agent":"Lumia AI Agent"} · Provider: {provider} · Model: {model}</div></div>}
    </section>
  </main>;
}