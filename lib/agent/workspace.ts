import path from "node:path";
import fs from "node:fs/promises";

export const WORKSPACE_BASE = path.resolve(process.env.WORKSPACE_BASE || path.join(process.cwd(),"workspaces"));
const IGNORED = new Set(["node_modules",".git",".next","dist","build",".turbo",".cache"]);
const MAX_FILE_BYTES = Number(process.env.LUMIA_MAX_FILE_BYTES || 1_000_000);
const MAX_RESULTS = Number(process.env.LUMIA_MAX_RESULTS || 500);

export function projectRoot(projectId:string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(projectId)) throw new Error("Invalid project id");
  return path.join(WORKSPACE_BASE,projectId);
}
export function safePath(projectId:string, relativePath:string) {
  const root=path.resolve(projectRoot(projectId));
  const clean=String(relativePath||".").replace(/\\/g,"/");
  const absolute=path.resolve(root,clean);
  const prefix=root.endsWith(path.sep)?root:root+path.sep;
  if(absolute!==root&&!absolute.startsWith(prefix)) throw new Error("Path escapes project workspace");
  return absolute;
}
export async function ensureProjectWorkspace(projectId:string) {
  const root=projectRoot(projectId);
  await fs.mkdir(root,{recursive:true});
  return root;
}
export { IGNORED,MAX_FILE_BYTES,MAX_RESULTS };