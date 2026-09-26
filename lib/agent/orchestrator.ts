import { prisma } from "@/lib/prisma";
import { openAIProvider } from "./provider";
import { TOOL_DEFINITIONS } from "./tools";
import { SPECIALISTS, specialistPrompt, type SpecialistRole } from "./specialists";

type ContextMessage = { role:"user"|"assistant"; content:string };

export async function runAutonomousCodingTask(
  projectId:string,
  conversationId:string,
  prompt:string,
  history:ContextMessage[],
  onEvent:(event:any)=>void
){
  const maxTurns=Math.max(1,Math.min(Number(process.env.LUMIA_AGENT_MAX_TURNS||12),30));
  const specialistTurns=Math.max(1,Math.min(Number(process.env.LUMIA_SPECIALIST_TURNS||4),8));

  const execution=await prisma.agentExecution.create({
    data:{projectId,conversationId,status:"RUNNING",prompt}
  });

  const shared:string[]=[];
  let totalTools=0;
  let totalTurns=0;

  const runRole=async(role:SpecialistRole,task:string)=>{
    onEvent({type:"specialist_start",role,name:SPECIALISTS[role].name});
    const context=shared.join("\n\n").slice(-12000);
    const result=await openAIProvider.run(
      specialistPrompt(role,task,context),
      history,
      TOOL_DEFINITIONS.map(tool=>tool as any),
      event=>onEvent({...event,role}),
      specialistTurns
    );
    totalTools+=result.toolCount;
    totalTurns+=result.turns;
    shared.push(SPECIALISTS[role].name+": "+result.text);
    onEvent({type:"specialist_complete",role,name:SPECIALISTS[role].name});
    return result;
  };

  try{
    const planner=await runRole("planner",prompt);

    const coder=await runRole(
      "coder",
      prompt+"\nPlanner output:\n"+planner.text+
      "\nImplement the requested changes in the project workspace."
    );

    const reviewer=await runRole(
      "reviewer",
      prompt+"\nPlanner output:\n"+planner.text+
      "\nCoder output:\n"+coder.text+
      "\nReview the actual project state and identify concrete issues."
    );

    let debuggerText="";
    if(/fail|error|bug|regression|missing|incorrect|broken/i.test(reviewer.text)){
      const debuggerResult=await runRole(
        "debugger",
        prompt+"\nReview findings:\n"+reviewer.text+
        "\nInspect the project and repair the identified problems."
      );
      debuggerText=debuggerResult.text;
    }

    const verifier=await runRole(
      "verifier",
      prompt+"\nReview:\n"+reviewer.text+
      (debuggerText?"\nDebugger:\n"+debuggerText:"")+
      "\nVerify the current project with the available tools. Run an appropriate check when possible."
    );

    const final=[
      "Planner: "+planner.text,
      "Coder: "+coder.text,
      "Reviewer: "+reviewer.text,
      debuggerText?"Debugger: "+debuggerText:"",
      "Verifier: "+verifier.text
    ].filter(Boolean).join("\n\n");

    await prisma.agentExecution.update({
      where:{id:execution.id},
      data:{status:"SUCCEEDED",result:final,toolCount:totalTools,finishedAt:new Date()}
    });

    return {text:final,toolCount:totalTools,turns:Math.min(totalTurns,maxTurns)};
  }catch(error){
    const message=error instanceof Error?error.message:"Specialist pipeline failed";
    await prisma.agentExecution.update({
      where:{id:execution.id},
      data:{status:"FAILED",error:message,toolCount:totalTools,finishedAt:new Date()}
    });
    throw error;
  }
}