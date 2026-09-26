import type { SpecialistRole } from "./specialists";

export type LumiaToolName = "list_files" | "read_file" | "search_code" | "write_file" | "run_command" | "git_status";

export type ToolPermissionAction = "inspect" | "edit" | "execute" | "git";

export const TOOL_PERMISSION_MATRIX: Record<SpecialistRole, Record<LumiaToolName, boolean>> = {
  planner: { list_files:true, read_file:true, search_code:true, write_file:false, run_command:false, git_status:true },
  coder: { list_files:true, read_file:true, search_code:true, write_file:true, run_command:true, git_status:true },
  reviewer: { list_files:true, read_file:true, search_code:true, write_file:false, run_command:true, git_status:true },
  debugger: { list_files:true, read_file:true, search_code:true, write_file:true, run_command:true, git_status:true },
  verifier: { list_files:true, read_file:true, search_code:true, write_file:false, run_command:true, git_status:true },
  researcher: { list_files:true, read_file:true, search_code:true, write_file:false, run_command:false, git_status:false },
  "security-reviewer": { list_files:true, read_file:true, search_code:true, write_file:false, run_command:true, git_status:true },
  "ui-specialist": { list_files:true, read_file:true, search_code:true, write_file:true, run_command:true, git_status:true },
  "database-specialist": { list_files:true, read_file:true, search_code:true, write_file:true, run_command:true, git_status:true }
};

export function canUseTool(role: SpecialistRole, name: string): boolean {
  return Boolean(TOOL_PERMISSION_MATRIX[role]?.[name as LumiaToolName]);
}

export function assertToolPermission(role: SpecialistRole, name: string) {
  if (!canUseTool(role, name)) {
    throw new Error(`Tool "${name}" is not permitted for specialist "${role}".`);
  }
}
