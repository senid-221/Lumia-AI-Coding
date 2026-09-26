import { runProjectCommand } from "@/lib/agent/command-runner";

const SAFE_BRANCH=/^[A-Za-z0-9._/-]{1,80}$/;

export async function createProjectBranch(projectId:string,branch:string){
  if(!SAFE_BRANCH.test(branch)||branch.startsWith("-")) throw new Error("Invalid branch name");
  return runProjectCommand(projectId,"git",["switch","-c",branch]);
}

export async function commitProjectChanges(projectId:string,message:string){
  const trimmed=message.trim();
  if(!trimmed||trimmed.length>200) throw new Error("Commit message is required");
  if(trimmed.startsWith("-")) throw new Error("Invalid commit message");
  return runProjectCommand(projectId,"git",["commit","-am",trimmed]);
}