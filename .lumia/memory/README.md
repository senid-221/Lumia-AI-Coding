# Lumia Persistent Context

This directory defines the project-local memory contract.

Memory must contain only useful project context such as:
- stable architecture decisions
- project conventions
- important constraints
- verified implementation facts
- durable task context

Do not store secrets, passwords, access tokens, private keys, or unnecessary personal data.

Runtime durable user memory is stored through Lumia's authenticated database memory system. This directory is a rule/documentation boundary, not a place for fabricated memory.
