# Lumia + Paperclip Master Integration

The uploaded Paperclip master was used as an architecture reference, not copied wholesale.

Lumia keeps the existing reference UI and adds Paperclip-inspired execution concepts:
- adapter-oriented runtime boundary
- bounded execution runs
- persistent execution records
- live activity updates
- workspace isolation
- allowlisted development commands
- resumable conversation context
- tool execution with explicit call/result pairs
- room for local Claude/Codex/other adapters later

Paperclip's documented model separates the control plane from execution adapters and uses heartbeats/runs with status, logs and resumable sessions. Lumia applies those ideas to a compact coding workspace.