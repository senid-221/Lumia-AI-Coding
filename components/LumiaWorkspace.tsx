"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Settings, X, Menu, ChevronDown, Bot, Loader2, LayoutGrid, History, Plug, Rocket, FolderPlus, MessageSquarePlus, BookOpen, UserRound, Info, Paperclip, Mic, Copy, ThumbsUp, ThumbsDown, RotateCcw, Check, SlidersHorizontal, ShieldCheck, Trash2, Sun, Monitor, Keyboard } from "lucide-react";

type Msg = { role:"user"|"assistant"; content:string; id:string };
type ConversationSummary = { id:string; title:string|null; updatedAt:string };
type MenuState = "none"|"main"|"lumia"|"agent"|"provider"|"model"|"settings";
type MainAction = "new"|"services"|"history"|"settings"|"connectors"|"deploy"|"projects"|"files"|"docs"|"account"|"about";
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
  const [historyOpen,setHistoryOpen] = useState(false);
  const [conversations,setConversations] = useState<ConversationSummary[]>([]);
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
  const [projects,setProjects] = useState<any[]>([]);
  const [activeProjectId,setActiveProjectId] = useState<string>("");
  const [executions,setExecutions] = useState<any[]>([]);
  const [integrations,setIntegrations] = useState<any[]>([]);
  const [workspacePanel,setWorkspacePanel] = useState<"none"|"activity"|"projects"|"connectors"|"deploy"|"files">("none");
  const [deploying,setDeploying] = useState(false);
  const [deployResult,setDeployResult] = useState<any>(null);
  const [fileEntries,setFileEntries] = useState<any[]>([]);
  const [selectedFile,setSelectedFile] = useState("");
  const [fileDraft,setFileDraft] = useState("");
  const [fileSearch,setFileSearch] = useState("");
  const [fileSaving,setFileSaving] = useState(false);
  const [settingsTab,setSettingsTab] = useState<"general"|"ai"|"execution"|"privacy">("general");
  const [compactMode,setCompactMode] = useState(false);
  const [autoScroll,setAutoScroll] = useState(true);
  const [enterToSend,setEnterToSend] = useState(true);
  const [showActivity,setShowActivity] = useState(true);
  const [confirmCommands,setConfirmCommands] = useState(true);
  const rootRef=useRef<HTMLElement>(null);
  const chatEndRef=useRef<HTMLDivElement>(null);
  const providerEntry=liveProviders.find(p=>p.id===provider);
  const models=providerEntry?.models || [];
  const selectedModel=models.find(m=>m.id===model);

  async function loadProjects() {
    const res=await fetch("/api/projects",{cache:"no-store"}); if(!res.ok) return;
    const data=await res.json(); let list=data.projects||[];
    if(!list.length){ const created=await fetch("/api/projects",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:"AI Agent"})}); if(created.ok) list=[(await created.json()).project]; }
    setProjects(list); if(!activeProjectId && list[0]?.id) setActiveProjectId(list[0].id);
  }
  async function loadExecutions(id=activeProjectId){ if(!id) return; const r=await fetch("/api/projects/"+id+"/executions?limit=30",{cache:"no-store"}); if(r.ok) setExecutions((await r.json()).executions||[]); }
  async function loadIntegrations(id=activeProjectId){ if(!id) return; const r=await fetch("/api/projects/"+id+"/integrations",{cache:"no-store"}); if(r.ok){const d=await r.json();setIntegrations(d.integrations||[]);} }
  async function loadFiles(path="."){ if(!activeProjectId) return; const r=await fetch("/api/projects/"+activeProjectId+"/files?action=list&path="+encodeURIComponent(path),{cache:"no-store"}); if(r.ok) setFileEntries((await r.json()).files||[]); }
  async function openFile(path:string){ if(!activeProjectId) return; const r=await fetch("/api/projects/"+activeProjectId+"/files?action=read&path="+encodeURIComponent(path),{cache:"no-store"}); if(r.ok){const d=await r.json();setSelectedFile(path);setFileDraft(String(d.content||""));} }
  async function saveFile(){ if(!activeProjectId||!selectedFile) return; setFileSaving(true); try{const r=await fetch("/api/projects/"+activeProjectId+"/files",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({path:selectedFile,content:fileDraft})}); if(!r.ok) throw new Error((await r.json()).error||"Save failed"); setNotice("File saved."); loadExecutions();}catch(e){setError(e instanceof Error?e.message:"Save failed");}finally{setFileSaving(false);} }
  async function cancelExecution(id:string){ const r=await fetch("/api/projects/"+activeProjectId+"/executions/"+id+"/cancel",{method:"POST"}); if(!r.ok) setError((await r.json()).error||"Cancel failed"); await loadExecutions(); }
  async function resumeExecution(id:string){ const r=await fetch("/api/projects/"+activeProjectId+"/executions/"+id+"/resume",{method:"POST"}); if(!r.ok) setError((await r.json()).error||"Resume failed"); else setNotice("Execution queued for resume."); await loadExecutions(); }
  async function runDeployPreflight(){ if(!activeProjectId) return; setDeploying(true);setDeployResult(null); try{const r=await fetch("/api/projects/"+activeProjectId+"/deploy",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({confirm:true})});const d=await r.json();setDeployResult(d);await loadExecutions();}catch(e){setDeployResult({ready:false,error:e instanceof Error?e.message:"Deployment preflight failed"});}finally{setDeploying(false);} }


  useEffect(()=>{
    let cancelled=false;
    fetch("/api/chat",{cache:"no-store"})
      .then(async r=>{if(!r.ok) throw new Error("Unable to restore conversation"); return r.json();})
      .then(data=>{
        if(cancelled || !data?.conversation) return;
        setConversationId(data.conversation.id);
        setMessages((data.messages || []).map((m:any)=>({
          role:m.role==="user"?"user":"assistant",
          content:String(m.content || ""),
          id:String(m.id)
        })));
      })
      .catch(()=>{});
    return()=>{cancelled=true;};
  },[]);

  useEffect(()=>{
    const close=(e:MouseEvent)=>{ if(rootRef.current && !rootRef.current.contains(e.target as Node)) setMenu("none"); };
    document.addEventListener("mousedown",close);
    return()=>document.removeEventListener("mousedown",close);
  },[]);
  useEffect(()=>{ loadProjects(); },[]);
  useEffect(()=>{ if(activeProjectId){ loadExecutions(); loadIntegrations(); } },[activeProjectId]);
  useEffect(()=>{
    const raw=localStorage.getItem("lumia-settings"); if(!raw) return;
    try{const saved=JSON.parse(raw); if(typeof saved.compactMode==="boolean")setCompactMode(saved.compactMode); if(typeof saved.autoScroll==="boolean")setAutoScroll(saved.autoScroll); if(typeof saved.enterToSend==="boolean")setEnterToSend(saved.enterToSend); if(typeof saved.showActivity==="boolean")setShowActivity(saved.showActivity); if(typeof saved.confirmCommands==="boolean")setConfirmCommands(saved.confirmCommands); if(typeof saved.skipInstall==="boolean")setSkipInstall(saved.skipInstall); if(typeof saved.timerOn==="boolean")setTimerOn(saved.timerOn); if(typeof saved.provider==="string")setProvider(saved.provider); if(typeof saved.agent==="string")setAgent(saved.agent);}catch{}
  },[]);
  useEffect(()=>{ localStorage.setItem("lumia-settings",JSON.stringify({compactMode,autoScroll,enterToSend,showActivity,confirmCommands,skipInstall,timerOn,provider,agent})); },[compactMode,autoScroll,enterToSend,showActivity,confirmCommands,skipInstall,timerOn,provider,agent]);
  useEffect(()=>{ if(autoScroll) chatEndRef.current?.scrollIntoView({behavior:"smooth",block:"end"}); },[messages,status,autoScroll]);

  useEffect(()=>{
    let cancelled=false;
    setModelsLoading(true);
    fetch("/api/models",{cache:"no-store"})
      .then(async r=>{if(!r.ok) throw new Error("Unable to load models");return r.json();})
      .then(data=>{if(!cancelled) setLiveProviders(data.providers || []);})
      .catch(()=>{if(!cancelled) setError("Unable to load provider models. Refresh to retry.");})
      .finally(()=>{if(!cancelled) setModelsLoading(false);});
    return()=>{cancelled=true;};
  },[modelRefresh]);;

  useEffect(()=>{
    if(!models.some(m=>m.id===model)) setModel(models[0]?.id || "");
  },[provider,liveProviders,model]);


  async function send() {
    const value = task.trim();
    if (!value || busy) return;
    setTask(""); setError(""); setStatus("Thinking..."); setMessages(m=>[...m,{role:"user",content:value,id:crypto.randomUUID()}]); setBusy(true);
    try {
      const res = await fetch("/api/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task:value,conversationId,agent,provider,model,projectId:activeProjectId})});
      if (!res.ok || !res.body) throw new Error((await res.json().catch(()=>({}))).error || "Request failed");
      const reader = res.body.getReader(), decoder = new TextDecoder();
      let assistant = "";
      const assistantId = crypto.randomUUID();
      setMessages(m=>[...m,{role:"assistant",content:"",id:assistantId}]);
      let buffer = "";
      const handleEvent = (event:any) => {
        if(event.type==="conversation") setConversationId(event.id);
        if(event.type==="thinking" && showActivity) setStatus(event.detail || "Thinking...");
        if(event.type==="specialist_start" && showActivity) setStatus((event.name || "Agent").replace(/[-_]/g," ").replace(/\b\w/g,(c:string)=>c.toUpperCase()) + "...");
        if(event.type==="tool_start" && showActivity) {
          const labels:Record<string,string>={list_files:"Analysing files...",read_file:"Reading files...",search_code:"Analysing code...",write_file:"Building...",run_command:"Running command...",git_status:"Checking project..."};
          setStatus(labels[event.tool] || "Working...");
        }
        if(event.type==="tool_result" && showActivity) setStatus("Working...");
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

  async function loadHistory(){
    try{
      const res=await fetch("/api/conversations",{cache:"no-store"});
      if(!res.ok) throw new Error("Unable to load history");
      const data=await res.json();
      setConversations(data.conversations || []);
      setHistoryOpen(true);
    }catch{ setError("Unable to load conversation history."); }
  }

  async function openConversation(id:string){
    try{
      const res=await fetch("/api/chat?conversationId="+encodeURIComponent(id),{cache:"no-store"});
      if(!res.ok) throw new Error("Unable to open conversation");
      const data=await res.json();
      setConversationId(data.conversation?.id);
      setMessages((data.messages||[]).map((m:any)=>({role:m.role==="user"?"user":"assistant",content:String(m.content||""),id:String(m.id)})));
      setHistoryOpen(false);
      setMenu("none");
    }catch{setError("Unable to open that conversation.");}
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
    if(action==="history"){loadHistory();return;}
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

  return (
    <main className={"workspace"+(compactMode?" compact-mode":"")} ref={rootRef}>
      <header className="topbar">
        <div className="top-left">
          <button className="icon-btn" onClick={()=>setMenu(menu==="main"?"none":"main")} aria-label="Open menu"><Menu size={18}/></button>
          <button className="selector" onClick={()=>setMenu(menu==="lumia"?"none":"lumia")}><Bot size={15}/><span>lumia</span><ChevronDown size={13}/></button>
          <span className="slash">/</span>
          <button className="selector" onClick={()=>setMenu(menu==="agent"?"none":"agent")}><span>{agent}</span><ChevronDown size={13}/></button>
        </div>
        <div className="top-right">{accountControl}</div>
        {historyOpen&&<div className="menu-popover history-popover"><div className="menu-title">Conversation History <button className="settings-close" onClick={()=>setHistoryOpen(false)}><X size={15}/></button></div>{conversations.length===0?<div className="menu-note">No saved conversations yet.</div>:conversations.map(c=><button className="menu-item history-item" key={c.id} onClick={()=>openConversation(c.id)}><span>{c.title||"Untitled conversation"}</span><small>{new Date(c.updatedAt).toLocaleString()}</small></button>)}</div>}
        {menu==="main"&&<div className="menu-popover main-menu"><div className="menu-title">Lumia</div>{mainMenu.map(item=><button className="menu-item menu-action" key={item.id} onClick={()=>handleMainAction(item.id)}>{item.icon}<span>{item.label}</span>{item.id==="deploy"&&<span className="menu-shortcut">↗</span>}</button>)}</div>}
        {menu==="lumia"&&popup("Workspace",["lumia"],()=>{})}
        {menu==="agent"&&popup("Agent",agents,v=>setAgent(v))}
      </header>

      {workspacePanel!=="none" && <section style={{position:"fixed",right:18,top:62,zIndex:30,width:"min(760px,calc(100vw - 36px))",maxHeight:"calc(100vh - 84px)",overflow:"auto",background:"var(--panel,#fff)",border:"1px solid rgba(127,127,127,.2)",borderRadius:14,padding:18,boxShadow:"0 20px 60px rgba(0,0,0,.18)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div><b>{workspacePanel==="activity"?"Activity & Executions":workspacePanel==="projects"?"Projects":workspacePanel==="connectors"?"Connectors":workspacePanel==="deploy"?"Deployment": "Files & Editor"}</b><div style={{fontSize:12,opacity:.65}}>{projects.find(p=>p.id===activeProjectId)?.name||"AI Agent"}</div></div><button className="settings-close" onClick={()=>setWorkspacePanel("none")}><X size={16}/></button></div>\n        {workspacePanel==="activity"&&<div style={{display:"grid",gap:8}}>{executions.length===0?<div className="menu-note">No executions yet.</div>:executions.map(e=><div key={e.id} style={{padding:10,border:"1px solid rgba(127,127,127,.15)",borderRadius:10}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><b>{e.status}</b><small>{new Date(e.startedAt).toLocaleString()}</small></div><div style={{fontSize:13,margin:"5px 0"}}>{e.prompt}</div><small>Tools: {e.toolCount} · Events: {e._count?.events||0}</small><div style={{marginTop:7,display:"flex",gap:6}}>{["RUNNING","CANCEL_REQUESTED"].includes(e.status)&&<button className="settings-action" onClick={()=>cancelExecution(e.id)}>Cancel</button>}{["CANCELLED","FAILED"].includes(e.status)&&<button className="settings-action" onClick={()=>resumeExecution(e.id)}>Resume</button>}</div></div>)}</div>}\n        {workspacePanel==="projects"&&<div style={{display:"grid",gap:8}}>{projects.map(p=><div key={p.id} style={{display:"flex",gap:8,alignItems:"center",padding:9,border:"1px solid rgba(127,127,127,.15)",borderRadius:10}}><button className="menu-item" style={{flex:1,textAlign:"left"}} onClick={()=>{setActiveProjectId(p.id);setWorkspacePanel("activity");}}>{p.name}<small style={{display:"block",opacity:.6}}>{p.slug}</small></button><button className="settings-action" onClick={async()=>{const name=window.prompt("Project name",p.name);if(!name)return;await fetch("/api/projects/"+p.id,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({name})});loadProjects();}}>Rename</button><button className="danger-action" onClick={async()=>{if(!window.confirm("Delete this project?"))return;await fetch("/api/projects/"+p.id,{method:"DELETE"});if(activeProjectId===p.id)setActiveProjectId("");loadProjects();}}>Delete</button></div>)}<button className="settings-action" onClick={async()=>{const name=window.prompt("New project name","New Project");if(name){await fetch("/api/projects",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name})});loadProjects();}}}>+ New project</button></div>}\n        {workspacePanel==="connectors"&&<div style={{display:"grid",gap:10}}>{["github","google"].map(providerName=><div key={providerName} style={{padding:12,border:"1px solid rgba(127,127,127,.15)",borderRadius:10}}><b>{providerName==="github"?"GitHub":"Google"}</b><div style={{fontSize:12,opacity:.65,margin:"4px 0 8px"}}>Connection state is stored per account. OAuth authorization is still required before private data access.</div><button className="settings-action" onClick={async()=>{if(!activeProjectId)return;await fetch("/api/projects/"+activeProjectId+"/integrations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({provider:providerName,name:providerName==="github"?"GitHub":"Google"})});loadIntegrations();}}>Register connector</button></div>)}{integrations.length>0&&<div><b>Configured</b>{integrations.map(i=><div key={i.id} style={{display:"flex",justifyContent:"space-between",padding:8}}><span>{i.name} · {i.status}</span><button className="danger-action" onClick={async()=>{await fetch("/api/projects/"+activeProjectId+"/integrations?integrationId="+i.id,{method:"DELETE"});loadIntegrations();}}>Disconnect</button></div>)}</div>}</div>}\n        {workspacePanel==="deploy"&&<div style={{display:"grid",gap:10}}><p style={{fontSize:13,opacity:.75}}>Lumia runs a deployment preflight: Git status and production build. It does not publish anywhere without a deployment provider connection.</p><button className="settings-action" disabled={deploying} onClick={runDeployPreflight}>{deploying?"Running preflight...":"Run deployment preflight"}</button>{deployResult&&<pre style={{whiteSpace:"pre-wrap",fontSize:12,padding:10,borderRadius:8,background:"rgba(127,127,127,.08)"}}>{JSON.stringify(deployResult,null,2)}</pre>}</div>}\n        {workspacePanel==="files"&&<div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:12,minHeight:400}}><div><input placeholder="Filter files..." value={fileSearch} onChange={e=>setFileSearch(e.target.value)} style={{width:"100%",padding:8,marginBottom:8}}/>{fileEntries.filter((f:any)=>String(f.path||f.name||"").toLowerCase().includes(fileSearch.toLowerCase())).map((f:any)=><button key={f.path||f.name} className="menu-item" style={{display:"block",width:"100%",textAlign:"left"}} onClick={()=>openFile(f.path||f.name)}>{f.path||f.name}</button>)}</div><div><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><b>{selectedFile||"Select a file"}</b>{selectedFile&&<button className="settings-action" disabled={fileSaving} onClick={saveFile}>{fileSaving?"Saving...":"Save"}</button>}</div><textarea value={fileDraft} onChange={e=>setFileDraft(e.target.value)} style={{width:"100%",minHeight:390,fontFamily:"monospace",fontSize:12,padding:10}} placeholder="Select a project file to edit." /></div></div>}\n      </section>}\n\n      <section className="chat-shell">
        {messages.length===0 && (
          <div className="empty-state">
            <div className="empty-mark"><Bot size={28}/></div>
            <h1>Lumia AI Agent</h1>
            <p>Multi-agent AI coding platform powered by <span>BeeLimited</span> and <span>RwaCodex</span>.</p>
          </div>
        )}

        {messages.length>0 && (
          <section className="chat-feed">
            {messages.map(m=>(
              <div className={"message-row "+m.role} key={m.id}>
                {m.role==="assistant" && <div className="message-avatar"><Bot size={17}/></div>}
                <div className="message-stack">
                  <div className="message-role">{m.role==="user"?"You":"Lumia"}</div>
                  <div className="message-content">
                    {m.content || (busy && <span className="thinking-dots"><i></i><i></i><i></i></span>)}
                  </div>
                  {m.role==="assistant" && m.content && (
                    <div className="message-tools">
                      <button title="Copy"><Copy size={14}/></button>
                      <button title="Like"><ThumbsUp size={14}/></button>
                      <button title="Dislike"><ThumbsDown size={14}/></button>
                      <button title="Retry"><RotateCcw size={14}/></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        <div ref={chatEndRef} aria-hidden="true" />
        {status && <div className="agent-status"><span className="status-dot"></span><span>{status}</span><span className="status-pulse">•••</span></div>}
        {error && <div className="error-banner">{error}</div>}

        <section className="composer">
          <button className="composer-icon" aria-label="Attach file"><Paperclip size={18}/></button>
          <textarea value={task} onChange={e=>setTask(e.target.value)} onKeyDown={e=>{if(enterToSend && e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Message Lumia AI Agent..." rows={1}/>
          <button className="composer-icon" aria-label="Voice input"><Mic size={18}/></button>

          <div className="composer-selectors">
            <button className="composer-pill" onClick={()=>setMenu(menu==="provider"?"none":"provider")} aria-label="Select AI provider">
              <span>{providerNames[provider]}</span><ChevronDown size={13}/>
            </button>
            <button className="composer-pill model-pill" onClick={()=>setMenu(menu==="model"?"none":"model")} aria-label="Select AI model">
              <span>{selectedModel?.label || (modelsLoading ? "Loading models..." : "Select model")}</span><ChevronDown size={13}/>
            </button>
          </div>

          <button className="send-btn" onClick={send} disabled={busy||!task.trim()||!model} aria-label="Send"><Send size={17}/></button>
        </section>

        {menu==="provider"&&<div className="menu-popover"><div className="menu-title">Select provider</div>{providerIds.map(id=><button className="menu-item" key={id} onClick={()=>{setProvider(id);setModel("");setModelSearch("");setMenu("none");}}>{providerNames[id]}{liveProviders.find(p=>p.id===id)?.configured===false?" · API key missing":""}</button>)}</div>}

        {menu==="model"&&<div className="menu-popover model-popover" style={{maxHeight:360,overflowY:"auto",minWidth:260}}>
          <div className="menu-title">{providerNames[provider]} models <button className="menu-item" style={{display:"inline-block",float:"right",padding:"2px 6px"}} onClick={()=>setModelRefresh(v=>v+1)}>↻</button></div>
          <input aria-label="Search models" placeholder="Search models..." value={modelSearch} onChange={e=>setModelSearch(e.target.value)} style={{width:"100%",padding:8,marginBottom:8}}/>
          {modelsLoading?<div className="menu-note">Loading models...</div>:providerEntry?.error?<div className="menu-note">{providerEntry.error}</div>:providerEntry?.configured===false?<div className="menu-note">{providerNames[provider]} API key is not configured on the server.</div>:models.length===0?<div className="menu-note">Provider is configured but returned no models. Check the API key permissions and provider endpoint.</div>:models.filter(m=>(m.label+" "+m.id).toLowerCase().includes(modelSearch.toLowerCase())).map(m=><button className="menu-item" key={m.id} onClick={()=>{setModel(m.id);setMenu("none");setModelSearch("");}}>{m.label}{m.label!==m.id?<small style={{display:"block",opacity:.6}}>{m.id}</small>:null}</button>)}
        </div>}

        {menu==="settings"&&<div className="settings-panel">
          <div className="settings-head">
            <div><div className="settings-title">Settings</div><div className="settings-subtitle">Control how Lumia looks, responds, and runs tasks.</div></div>
            <button className="settings-close" onClick={()=>setMenu("none")}><X size={17}/></button>
          </div>
          <div className="settings-body">
            <aside className="settings-nav">
              {[
                ["general","General",<SlidersHorizontal size={15}/>],
                ["ai","AI & Models",<Bot size={15}/>],
                ["execution","Execution",<ShieldCheck size={15}/>],
                ["privacy","Privacy & Reset",<Trash2 size={15}/>]
              ].map(([id,label,icon])=><button key={String(id)} className={settingsTab===id?"settings-nav-item active":"settings-nav-item"} onClick={()=>setSettingsTab(id as typeof settingsTab)}>{icon}<span>{label}</span></button>)}
            </aside>
            <section className="settings-content">
              {settingsTab==="general"&&<>
                <div className="settings-section"><h3>Interface</h3>
                  <label className="setting-row"><span><b>Compact mode</b><small>Reduce spacing in conversations and controls.</small></span><input type="checkbox" checked={compactMode} onChange={e=>setCompactMode(e.target.checked)}/></label>
                  <label className="setting-row"><span><b>Show activity</b><small>Show what Lumia is currently doing while it works.</small></span><input type="checkbox" checked={showActivity} onChange={e=>setShowActivity(e.target.checked)}/></label>
                  <label className="setting-row"><span><b>Auto-scroll</b><small>Keep the conversation at the latest response.</small></span><input type="checkbox" checked={autoScroll} onChange={e=>setAutoScroll(e.target.checked)}/></label>
                </div>
                <div className="settings-section"><h3>Keyboard</h3>
                  <label className="setting-row"><span><b>Enter to send</b><small>Press Enter to send; Shift + Enter creates a new line.</small></span><input type="checkbox" checked={enterToSend} onChange={e=>setEnterToSend(e.target.checked)}/></label>
                </div>
                <div className="settings-info"><Keyboard size={15}/><span>Current agent: <b>{agent}</b></span></div>
              </>}
              {settingsTab==="ai"&&<>
                <div className="settings-section"><h3>Default AI provider</h3>
                  <div className="settings-options">{providerIds.map(id=><button key={id} className={provider===id?"choice active":"choice"} onClick={()=>{setProvider(id);setModel("");}}>{provider===id&&<Check size={14}/>}<span>{providerNames[id]}</span></button>)}</div>
                </div>
                <div className="settings-section"><h3>Current model</h3>
                  <div className="settings-current"><Bot size={16}/><div><b>{selectedModel?.label || "No model selected"}</b><small>{selectedModel?.id || "Choose a provider with a configured API key."}</small></div></div>
                  <button className="settings-action" onClick={()=>{setMenu("model")}}>Choose model</button>
                  <button className="settings-action" onClick={()=>setModelRefresh(v=>v+1)}>Refresh available models</button>
                </div>
              </>}
              {settingsTab==="execution"&&<>
                <div className="settings-section"><h3>Agent execution</h3>
                  <label className="setting-row"><span><b>Skip install</b><small>Do not automatically install project dependencies when the workflow supports skipping.</small></span><input type="checkbox" checked={skipInstall} onChange={e=>setSkipInstall(e.target.checked)}/></label>
                  <label className="setting-row"><span><b>Execution timer</b><small>Keep the task time control enabled in the workspace.</small></span><input type="checkbox" checked={timerOn} onChange={e=>setTimerOn(e.target.checked)}/></label>
                  <label className="setting-row"><span><b>Confirm commands</b><small>Keep an explicit confirmation boundary for commands that may change the project.</small></span><input type="checkbox" checked={confirmCommands} onChange={e=>setConfirmCommands(e.target.checked)}/></label>
                </div>
                <div className="settings-info"><ShieldCheck size={15}/><span>Verification remains required before Lumia reports coding work as complete.</span></div>
              </>}
              {settingsTab==="privacy"&&<>
                <div className="settings-section"><h3>Local workspace data</h3>
                  <button className="danger-action" onClick={()=>{setMessages([]);setConversationId(undefined);setTask("");setNotice("Current chat cleared.");setMenu("none");}}>Clear current chat</button>
                  <button className="settings-action" onClick={()=>{localStorage.removeItem("lumia-settings");setCompactMode(false);setAutoScroll(true);setEnterToSend(true);setShowActivity(true);setConfirmCommands(true);setSkipInstall(false);setTimerOn(true);setNotice("Settings reset to defaults.");}}>Reset all settings</button>
                </div>
                <div className="settings-info"><Monitor size={15}/><span>These interface preferences are stored locally in this browser.</span></div>
              </>}
            </section>
          </div>
        </div>}
      </section>

      {notice && <div className="toast-notice">{notice}</div>}
    </main>
  );}