import fs from "node:fs/promises";
import path from "node:path";
import { ensureProjectWorkspace,safePath,IGNORED,MAX_FILE_BYTES,MAX_RESULTS } from "./workspace";

const TEXT_EXT=/\.(ts|tsx|js|jsx|mjs|cjs|json|css|scss|html|md|mdx|yml|yaml|xml|svg|txt|sql|py|go|rs|java|kt|php|rb|sh)$/i;

export async function listProjectFiles(projectId:string,relativePath=".") {
  const root=await ensureProjectWorkspace(projectId), start=safePath(projectId,relativePath);
  const out:string[]=[];
  async function walk(dir:string,depth=0) {
    if(depth>8||out.length>=MAX_RESULTS)return;
    for(const entry of await fs.readdir(dir,{withFileTypes:true})) {
      if(out.length>=MAX_RESULTS||IGNORED.has(entry.name))continue;
      const absolute=path.join(dir,entry.name), relative=path.relative(root,absolute)||".";
      out.push(entry.isDirectory()?relative+"/":relative);
      if(entry.isDirectory())await walk(absolute,depth+1);
    }
  }
  await walk(start); return out;
}
export async function readProjectFile(projectId:string,relativePath:string) {
  const absolute=safePath(projectId,relativePath), stat=await fs.stat(absolute);
  if(!stat.isFile())throw new Error("Not a file");
  if(stat.size>MAX_FILE_BYTES)throw new Error("File exceeds Lumia read limit");
  return fs.readFile(absolute,"utf8");
}
export async function writeProjectFile(projectId:string,relativePath:string,content:string) {
  if(Buffer.byteLength(content,"utf8")>MAX_FILE_BYTES)throw new Error("File exceeds Lumia write limit");
  const absolute=safePath(projectId,relativePath);
  await fs.mkdir(path.dirname(absolute),{recursive:true}); await fs.writeFile(absolute,content,"utf8");
  return {path:relativePath,bytes:Buffer.byteLength(content,"utf8")};
}
export async function searchProjectCode(projectId:string,query:string,relativePath=".") {
  if(!query.trim())throw new Error("Search query is required");
  const root=await ensureProjectWorkspace(projectId),start=safePath(projectId,relativePath);
  const hits:{path:string;line:number;snippet:string}[]=[];
  async function walk(dir:string,depth=0) {
    if(depth>8||hits.length>=MAX_RESULTS)return;
    for(const entry of await fs.readdir(dir,{withFileTypes:true})) {
      if(hits.length>=MAX_RESULTS||IGNORED.has(entry.name))continue;
      const absolute=path.join(dir,entry.name);
      if(entry.isDirectory()){await walk(absolute,depth+1);continue;}
      if(!TEXT_EXT.test(entry.name))continue;
      try{
        const stat=await fs.stat(absolute); if(stat.size>MAX_FILE_BYTES)continue;
        const lines=(await fs.readFile(absolute,"utf8")).split(/\r?\n/);
        lines.forEach((line,index)=>{if(hits.length<MAX_RESULTS&&line.toLowerCase().includes(query.toLowerCase()))hits.push({path:path.relative(root,absolute),line:index+1,snippet:line.slice(0,500)})});
      }catch{}
    }
  }
  await walk(start); return hits;
}