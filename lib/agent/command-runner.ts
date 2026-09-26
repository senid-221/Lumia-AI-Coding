import { spawn } from "node:child_process";
import path from "node:path";
import { ensureProjectWorkspace } from "./workspace";

const ALLOWED = new Set(["node","npm","npx","pnpm","yarn","python","python3","git"]);
const BLOCKED = new Set(["sudo","rm","rmdir","del","shutdown","reboot","format","mkfs","curl","wget"]);

export type RunResult = { command:string; args:string[]; code:number|null; stdout:string; stderr:string; timedOut:boolean; durationMs:number };

function assertArgs(args:string[]) {
  for (const arg of args) {
    if (arg.includes(String.fromCharCode(0)) || /[;&|<>`$]/.test(arg)) throw new Error("Unsafe shell characters are not allowed");
    if (BLOCKED.has(path.basename(arg).toLowerCase())) throw new Error("Destructive, network, or privilege command is not allowed");
  }
}

export async function runProjectCommand(projectId:string, command:string, args:string[]=[]):Promise<RunResult> {
  if (!ALLOWED.has(command)) throw new Error("Command is not allowed");
  assertArgs(args);
  const cwd=await ensureProjectWorkspace(projectId);
  const started=Date.now();
  const timeoutMs=Number(process.env.LUMIA_COMMAND_TIMEOUT_MS || 120000);
  const maxBytes=Number(process.env.LUMIA_COMMAND_OUTPUT_BYTES || 500000);
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd,env:{PATH:process.env.PATH||"",HOME:process.env.HOME||"",NODE_ENV:"development",CI:"1"},shell:false,windowsHide:true});
    let stdout="",stderr="",timedOut=false,truncated=false;
    const append=(kind:"out"|"err",chunk:Buffer|string)=>{
      if(kind==="out") stdout+=String(chunk); else stderr+=String(chunk);
      if(Buffer.byteLength(stdout)+Buffer.byteLength(stderr)>maxBytes){truncated=true;child.kill("SIGTERM");}
    };
    child.stdout.on("data",c=>append("out",c)); child.stderr.on("data",c=>append("err",c));
    const timer=setTimeout(()=>{timedOut=true;child.kill("SIGTERM");},timeoutMs);
    child.on("error",reject);
    child.on("close",code=>{
      clearTimeout(timer);
      if(truncated) stderr+="\n[Lumia: output truncated at limit]";
      if(timedOut) stderr+="\n[Lumia: command timed out]";
      resolve({command,args,code,stdout,stderr,timedOut,durationMs:Date.now()-started});
    });
  });
}