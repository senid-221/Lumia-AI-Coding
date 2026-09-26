"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Settings, X, Menu, ChevronDown, Bot, Loader2, LayoutGrid, History, Plug, Rocket, FolderPlus, MessageSquarePlus, BookOpen, UserRound, Info, Paperclip, Mic, Copy, ThumbsUp, ThumbsDown, RotateCcw } from "lucide-react";

type Msg = { role:"user"|"assistant"; content:string; id:string };
type MenuState = "none"|"main"|"lumia"|"agent"|"provider"|"model"|"settings";
type MainAction = "new"|"services"|"history"|"settings"|"connectors"|"deploy"|"projects"|"docs"|"account"|"about";
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
  const [status,setStatus] = useState("");
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
    setTask(""); setError(""); setStatus("Thinking..."); setMessages(m=>[...m,{role:"user",content:value,id:crypto.randomUUID()}]); setBusy(true);
    try {
      const res = await fetch("/api/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task:value,conversationId,agent,provider,model})});
      if (!res.ok || !res.body) throw new Error((await res.json().catch(()=>({}))).error || "Request failed");
      const reader = res.body.getReader(), decoder = new TextDecoder();
      let assistant = "";
      const assistantId = crypto.randomUUID();
      setMessages(m=>[...m,{role:"assistant",content:"",id:assistantId}]);
      let buffer = "";
      const handleEvent = (event:any) => {
        if(event.type==="conversation") setConversationId(event.id);
        if(event.type==="thinking") setStatus(event.detail || "Thinking...");
        if(event.type==="specialist_start") setStatus((event.name || "Agent").replace(/[-_]/g," ").replace(/\b\w/g,(c:string)=>c.toUpperCase()) + "...");
        if(event.type==="tool_start") {
          const labels:Record<string,string>={list_files:"Analysing files...",read_file:"Reading files...",search_code:"Analysing code...",write_file:"Building...",run_command:"Running command...",git_status:"Checking project..."};
          setStatus(labels[event.tool] || "Working...");
        }
        if(event.type==="tool_result") setStatus("Working...");
        if(event.type==="delta"){ assistant += event.text || ""; setMessages(m=>m.map(x=>x.id===assistantId?{...x,content:assistant}:x)); }
        if(event.type==="message"){ assistant = event.text || assistant; setMessages(m=>m.map(x=>x.id===assistantId?{...x,content:assistant}:x)); }
        if(event.type==="error") { setError(event.error); setStatus(""); }
        if(event.type==="complete") setStatus("");
      };
      while (true) {
        const {value:chunk,done}=await reader.read();
        buffer += decoder.decode(chunk || new Uint8Array(),{stream:!done});
        const lines=buffer.split("\n");
        buffer=lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data=line.slice(6).trim(); if(!data || data==="[DONE]") continue;
          try { handleEvent(JSON.parse(data)); }
          catch { setError("The server returned an invalid response. Please retry."); }
        }
        if(done) break;
      }
      if(buffer.startsWith("data: ")) {
        const data=buffer.slice(6).trim();
        if(data && data!=="[DONE]") { try { handleEvent(JSON.parse(data)); } catch {} }
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
    {id:"account",label:"Account",icon:<UserRound size={15}/>} ,
    {id:"about",label:"About",icon:<Info size={15}/>} ,
    {id:"settings",label:"Settings",icon:<Settings size={15}/>}
  ];

  function handleMainAction(action:MainAction){
    setMenu("none");
    if(action==="new"){setMessages([]);setConversationId(undefined);setTask("");return;}
    if(action==="settings"){setMenu("settings");return;}
    if(action==="about"){window.location.href="/about";return;}
    const notices: Record<string,string> = {
      services:"All Services — AI coding, agents, Hacking Lab, Git, reviews and automation.",
      history:"History — your previous Lumia conversations and agent runs.",
      projects:"Projects — manage your coding workspaces.",
      connectors:"Connectors — connect GitHub, Google, databases and external tools.",
      deploy:"Deploy — prepare this project for production deployment.",
      docs:"Documentation — Lumia AI Agent platform guides and services.",
      account:"Account — manage your Lumia profile and authentication.",
      about:"About — learn more about Lumia AI Agent."
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
    <section className="chat-shell">
      {messages.length===0 && <div className="empty-state"><div className="empty-mark"><Bot size={28}/></div><h1>Lumia AI Agent</h1><p>Multi-agent AI coding platform powered by <span>BeeLimited</span> and <span>RwaCodex</span>.</p></div>}
      {messages.length>0 && <section className="chat-feed">{messages.map(m=><div className={"message-row "+m.role} key={m.id}>
        {m.role==="assistant" && <div className="message-avatar"><Bot size={17}/></div>}
        <div className="message-stack"><div className="message-role">{m.role==="user"?"You":"Lumia"}</div><div className="message-content">{m.content || (busy && <span className="thinking-dots"><i></i><i></i><i></i></span>)}</div>{m.role==="assistant" && m.content && <div className="message-tools"><button title="Copy"><Copy size={14}/></button><button title="Like"><ThumbsUp size={14}/></button><button title="Dislike"><ThumbsDown size={14}/></button><button title="Retry"><RotateCcw size={14}/></button></div>}</div>
      </div>)}</section>}
      {status && <div className="agent-status"><span className="status-dot"></span><span>{status}</span><span className="status-pulse">•••</span></div>}
      {error && <div className="error-banner">{error}</div>}
      <section className="composer">
        <button className="composer-icon" aria-label="Attach file"><Paperclip size={18}/></button><textarea value={task} onChange={e=>setTask(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Message Lumia AI Agent..." rows={1}/><button className="composer-icon" aria-label="Voice input"><Mic size={18}/></button><button className="send-btn" onClick={send} disabled={busy||!task.trim()||!model} aria-label="Send"><Send size={17}/></button>
      </section>
      {menu==="provider"&&<div className="menu-popover"><div className="menu-title">Select provider</div>{providerIds.map(id=><button className="menu-item" key={id} onClick={()=>{setProvider(id);setModel("");setModelSearch("");setMenu("none");}}>{providerNames[id]}{liveProviders.find(p=>p.id===id)?.configured===false?" · API key missing":""}</button>)}</div>}
      {menu==="model"&&<div className="menu-popover model-popover" style={{maxHeight:360,overflowY:"auto",minWidth:260}}>
        <div className="menu-title">{providerNames[provider]} models <button className="menu-item" style={{display:"inline-block",float:"right",padding:"2px 6px"}} onClick={()=>setModelRefresh(v=>v+1)}>↻</button></div>
        <input aria-label="Search models" placeholder="Search models..." value={modelSearch} onChange={e=>setModelSearch(e.target.value)} style={{width:"100%",padding:8,marginBottom:8}}/>
        {modelsLoading?<div className="menu-note">Loading models...</div>:providerEntry?.error?<div className="menu-note">{providerEntry.error}</div>:providerEntry?.configured===false?<div className="menu-note">{providerNames[provider]} API key is not configured on the server.</div>:models.length===0?<div className="menu-note">Provider is configured but returned no models. Check the API key permissions and provider endpoint.</div>:models.filter(m=>(m.label+" "+m.id).toLowerCase().includes(modelSearch.toLowerCase())).map(m=><button className="menu-item" key={m.id} onClick={()=>{setModel(m.id);setMenu("none");setModelSearch("");}}>{m.label}{m.label!==m.id?<small style={{display:"block",opacity:.6}}>{m.id}</small>:null}</button>)}
      </div>}
      {menu==="settings"&&<div className="menu-popover settings-popover"><div className="menu-title">Lumia settings</div><button className="menu-item" onClick={()=>{setSkipInstall(false);setTimerOn(true);setMenu("none")}}>Reset controls</button><div className="menu-note">Agent: {agent==="hacking-lab"?"Lumia Hacking Lab Agent":"Lumia AI Agent"} · Provider: {providerNames[provider]} · Model: {selectedModel?.label || "None"}</div></div>}
      </section>
    </section>
    {notice && <div className="toast-notice">{notice}</div>}
  </main>;
}