import { ensureProjectWorkspace } from "./workspace";
import { listProjectFiles,readProjectFile,writeProjectFile,searchProjectCode } from "./project-files";
import { runProjectCommand } from "./command-runner";
import { ensureProjectWorkspace } from "./workspace";

export const TOOL_DEFINITIONS=[
 {type:"function",name:"list_files",description:"List project files.",parameters:{type:"object",properties:{path:{type:"string"}},required:["path"],additionalProperties:false},strict:true},
 {type:"function",name:"read_file",description:"Read a text file.",parameters:{type:"object",properties:{path:{type:"string"}},required:["path"],additionalProperties:false},strict:true},
 {type:"function",name:"search_code",description:"Search source code.",parameters:{type:"object",properties:{query:{type:"string"},path:{type:"string"}},required:["query","path"],additionalProperties:false},strict:true},
 {type:"function",name:"write_file",description:"Create or replace a text file.",parameters:{type:"object",properties:{path:{type:"string"},content:{type:"string"}},required:["path","content"],additionalProperties:false},strict:true},
 {type:"function",name:"run_command",description:"Run an allowlisted development command in the project workspace.",parameters:{type:"object",properties:{command:{type:"string"},args:{type:"array",items:{type:"string"}}},required:["command","args"],additionalProperties:false},strict:true},
 {type:"function",name:"git_status",description:"Inspect Git status.",parameters:{type:"object",properties:{},required:[],additionalProperties:false},strict:true}
] as const;

export async function executeTool(name:string,args:any,projectId:string){
 if(!projectId) throw new Error("Project scope is required");
 await ensureProjectWorkspace(projectId);
 const bound={...(args||{}),projectId};
 if(name==="list_files")return JSON.stringify(await listProjectFiles(projectId,bound.path||"."));
 if(name==="read_file")return await readProjectFile(projectId,bound.path);
 if(name==="search_code")return JSON.stringify(await searchProjectCode(projectId,bound.query,bound.path||"."));
 if(name==="write_file")return JSON.stringify(await writeProjectFile(projectId,bound.path,bound.content));
 if(name==="run_command")return JSON.stringify(await runProjectCommand(projectId,bound.command,bound.args||[]));
 if(name==="git_status")return JSON.stringify(await runProjectCommand(projectId,"git",["status","--short","--branch"]));
 throw new Error("Unknown tool");
}