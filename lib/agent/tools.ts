import { ensureProjectWorkspace } from "./workspace";
import { listProjectFiles,readProjectFile,writeProjectFile,searchProjectCode } from "./project-files";
import { runProjectCommand } from "./command-runner";

export const TOOL_DEFINITIONS=[
 {type:"function",name:"list_files",description:"List project files.",parameters:{type:"object",properties:{projectId:{type:"string"},path:{type:"string"}},required:["projectId","path"],additionalProperties:false},strict:true},
 {type:"function",name:"read_file",description:"Read a text file.",parameters:{type:"object",properties:{projectId:{type:"string"},path:{type:"string"}},required:["projectId","path"],additionalProperties:false},strict:true},
 {type:"function",name:"search_code",description:"Search source code.",parameters:{type:"object",properties:{projectId:{type:"string"},query:{type:"string"},path:{type:"string"}},required:["projectId","query","path"],additionalProperties:false},strict:true},
 {type:"function",name:"write_file",description:"Create or replace a text file.",parameters:{type:"object",properties:{projectId:{type:"string"},path:{type:"string"},content:{type:"string"}},required:["projectId","path","content"],additionalProperties:false},strict:true},
 {type:"function",name:"run_command",description:"Run an allowlisted development command in the project workspace.",parameters:{type:"object",properties:{projectId:{type:"string"},command:{type:"string"},args:{type:"array",items:{type:"string"}}},required:["projectId","command","args"],additionalProperties:false},strict:true},
 {type:"function",name:"git_status",description:"Inspect Git status.",parameters:{type:"object",properties:{projectId:{type:"string"}},required:["projectId"],additionalProperties:false},strict:true}
] as const;

export async function executeTool(name:string,args:any){
 if(name==="list_files")return JSON.stringify(await listProjectFiles(args.projectId,args.path||"."));
 if(name==="read_file")return await readProjectFile(args.projectId,args.path);
 if(name==="search_code")return JSON.stringify(await searchProjectCode(args.projectId,args.query,args.path||"."));
 if(name==="write_file")return JSON.stringify(await writeProjectFile(args.projectId,args.path,args.content));
 if(name==="run_command")return JSON.stringify(await runProjectCommand(args.projectId,args.command,args.args||[]));
 if(name==="git_status")return JSON.stringify(await runProjectCommand(args.projectId,"git",["status","--short","--branch"]));
 throw new Error("Unknown tool");
}