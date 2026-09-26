"use client";

import { useState } from "react";
import { Send, Settings, X, Menu, ChevronDown, Bot, Loader2 } from "lucide-react";

type Msg = { role:"user"|"assistant"; content:string };

export default function LumiaWorkspace({ accountControl }: { accountControl: React.ReactNode }) {
  const [task,setTask] = useState("");
  const [messages,setMessages] = useState<Msg[]>([]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [conversationId,setConversationId] = useState<string>();

  async function send() {
    const value = task.trim();
    if (!value || busy) return;
    setTask(""); setError(""); setMessages(m=>[...m,{role:"user",content:value}]); setBusy(true);
    try {
      const res = await fetch("/api/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task:value,conversationId})});
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

  return <main className="workspace">
    <header className="topbar">
      <div className="top-left"><button className="icon-btn"><Menu size={18}/></button><div className="selector"><Bot size={15}/><span>lumia</span><ChevronDown size={13}/></div><span className="slash">/</span><div className="selector"><span>ai-agent</span><ChevronDown size={13}/></div></div>
      <div className="top-right">{accountControl}<button className="dots">•••</button></div>
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
        <div className="composer-left"><span className="pill">Claude <ChevronDown size={12}/></span><span className="pill">Sonnet 4.5 <ChevronDown size={12}/></span><span className="pill muted">Skip Install <X size={12}/></span><span className="pill muted">10m <X size={12}/></span></div>
        <div className="composer-actions"><button className="icon-btn"><Settings size={17}/></button><button className="send-btn" onClick={send} disabled={busy||!task.trim()} aria-label="Send"><Send size={17}/></button></div>
      </div>
    </section>
  </main>;
}