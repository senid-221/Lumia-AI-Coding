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
type ModelOption = { id:string; label:string };
type ProviderOption = { id:string; label:string; models:ModelOption[]; configured?:boolean; error?:string };
const providerNames:Record<string,string>={anthropic:"Anthropic",openai:"OpenAI",google:"Google",xai:"xAI",groq:"Groq"};
const providerIds=Object.keys(providerNames);

export default function LumiaWorkspace({ accountControl }: { accountControl: React.ReactNode }) {
  const [task,setTask] = useState("");
  const [messages,setMessages] = useState<Msg[]>([]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [conversationId,setConversationId] = useState<string>();
  const [menu,setMenu] = useState<MenuState>("none");
  const [agent,setAgent] = useState("ai-agent");
  const [provider,setProvider] = useState("openai");
  const [model,setModel] = useState("");
  const [skipInstall,setSkipInstall] = useState(false);
  const [timerOn,setTimerOn] = useState(true);
  const [notice,setNotice] = useState("");
  const [liveProviders,setLiveProviders] = useState<ProviderOption[]>([]);
  const [modelsLoading,setModelsLoading] = useState(true);
  const [modelSearch,setModelSearch] = useState("");
  const [modelRefresh,setModelRefresh] = useState(0);
  const rootRef=useRef<HTMLElement>(null);
  const providerEntry=liveProviders.find(p=>p.id===provider);
  const models=providerEntry?.models || [];
  const selectedModel=models.find(m=>m.id===model);


  useEffect(()=>{
    const close=(e:MouseEvent)=>{ if(rootRef.current && !rootRef.current.contains(e.target as Node)) setMenu("none"); };
    document.addEventListener("mousedown",close);
    return()=>document.removeEventListener("mousedown",close);
  },[]);

  useEffect(()=>{
    let cancelled=false;
    setModelsLoading(true);
    fetch("/api/models",{cache:"no-store"})
      .then(async r=>{if(!r.ok) throw new Error("Unable to load models");return r.json();})
      .then(data=>{if(!cancelled) setLiveProviders(data.providers || []);})
      .catch(()=>{if(!cancelled) setError("Unable to load provider models. Refresh to retry.");})
      .finally(()=>{if(!cancelled) setModelsLoading(false);});
    return()=>{cancelled=true;};
  },[]);

  useEffect(()=>{
    if(!models.some(m=>m.id===model)) setModel(models[0]?.id || "");
  },[provider,liveProviders,model]);


  async function send() {
    const value = task.trim();
    if (!value || busy) return;
    setTask(""); setError(""); setMessages(m=>[...m,{role:"user",content:value}]); setBusy(true);
    try {
      const res = await fetch("/api/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task:value,conversationId,agent,provider,model})});
      if (!res.ok || !res.body) throw new Error((await res.json().catch(()=>({}))).error || "Request failed");
      const reader = res.body.getReader(), decoder = new TextDecoder();
      let assistant = "";
      setMessages(m=>[...m,{role:"assistant",content:""}]);
      while (true) {
        const {value:chunk,done}=await reader.read(); if(done) break;
        const text=decoder.decode(chunk,{stream:true});
        for (const line of text.split("
")) {
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
        <div className="composer-left"><button className="pill" onClick={()=>setMenu(menu==="provider"?"none":"provider")}>{providerNames[provider]} <ChevronDown size={12}/></button><button className="pill" onClick={()=>setMenu(menu==="model"?"none":"model")}>{selectedModel?.label || (modelsLoading?"Loading...":"Select model")} <ChevronDown size={12}/></button><button className="pill muted" onClick={()=>setSkipInstall(v=>!v)}>Skip Install {skipInstall?"✓":""}{!skipInstall&&<X size={12}/>}</button><button className="pill muted" onClick={()=>setTimerOn(v=>!v)}>{timerOn?"10m":"Timer off"} {timerOn&&<X size={12}/>}</button></div>
        <div className="composer-actions"><button className="icon-btn" onClick={()=>setMenu(menu==="settings"?"none":"settings")}><Settings size={17}/></button><button className="send-btn" onClick={send} disabled={busy||!task.trim()||!model} aria-label="Send"><Send size={17}/></button></div>
      </div>
      {menu==="provider"&&<div className="menu-popover"><div className="menu-title">Select provider</div>{providerIds.map(id=><button className="menu-item" key={id} onClick={()=>{setProvider(id);setModel("");setModelSearch("");setMenu("none");}}>{providerNames[id]}{liveProviders.find(p=>p.id===id)?.configured===false?" · API key missing":""}</button>)}</div>}
      {menu==="model"&&<div className="menu-popover model-popover" style={{maxHeight:360,overflowY:"auto",minWidth:260}}>
        <div className="menu-title">{providerNames[provider]} models <button className="menu-item" style={{display:"inline-block",float:"right",padding:"2px 6px"}} onClick={()=>setModelRefresh(v=>v+1)}>↻</button></div>
        <input aria-label="Search models" placeholder="Search models..." value={modelSearch} onChange={e=>setModelSearch(e.target.value)} style={{width:"100%",padding:8,marginBottom:8}}/>
        {modelsLoading?<div className="menu-note">Loading models...</div>:providerEntry?.error?<div className="menu-note">{providerEntry.error}</div>:models.length===0?<div className="menu-note">No models returned. Check this provider's API key.</div>:models.filter(m=>(m.label+" "+m.id).toLowerCase().includes(modelSearch.toLowerCase())).map(m=><button className="menu-item" key={m.id} onClick={()=>{setModel(m.id);setMenu("none");setModelSearch("");}}>{m.label}{m.label!==m.id?<small style={{display:"block",opacity:.6}}>{m.id}</small>:null}</button>)}
      </div>}
      {menu==="settings"&&<div className="menu-popover settings-popover"><div className="menu-title">Lumia settings</div><button className="menu-item" onClick={()=>{setSkipInstall(false);setTimerOn(true);setMenu("none")}}>Reset controls</button><div className="menu-note">Agent: {agent==="hacking-lab"?"Lumia Hacking Lab Agent":"Lumia AI Agent"} · Provider: {providerNames[provider]} · Model: {selectedModel?.label || "None"}</div></div>}
    </section>
  </main>;
}