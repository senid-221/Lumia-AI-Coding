export type SpecialistRole="planner"|"coder"|"reviewer"|"debugger"|"verifier";

export const SPECIALISTS:Record<SpecialistRole,{name:string;instructions:string}>={
  planner:{name:"Planner",instructions:"Break the user task into concrete implementation steps. Inspect before proposing changes."},
  coder:{name:"Coder",instructions:"Implement the plan using the available safe project tools. Keep changes focused."},
  reviewer:{name:"Reviewer",instructions:"Review the current project changes for correctness, regressions, security, and maintainability."},
  debugger:{name:"Debugger",instructions:"Analyze verification failures and identify the smallest safe repair."},
  verifier:{name:"Verifier",instructions:"Run or request appropriate verification and determine whether the task is complete."}
};

export function specialistPrompt(role:SpecialistRole,task:string,context:string){
  const s=SPECIALISTS[role];
  return `Role: ${s.name}.
${s.instructions}
Project task: ${task}
Shared context:
${context}`;
}