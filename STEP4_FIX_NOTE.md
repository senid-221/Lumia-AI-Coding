# Step 4 verification

The autonomous runtime has been added, but final verification is blocked by the current GitHub connector update metadata issue: file reads can expose content without a usable blob SHA for replacement.

Do not mark Step 4 complete until:
1. provider/orchestrator persistence is reconciled;
2. TypeScript/typecheck passes;
3. a real build runs;
4. autonomous tool loop is exercised in an isolated workspace.

The existing Lumia UI remains the design baseline.