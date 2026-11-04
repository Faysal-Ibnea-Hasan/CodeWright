# Example run

`medium-run/` holds the records of a real `/codewright run --mode medium` on a small Node orders API: adding an endpoint for admins to ship pending orders. It was run with no person present, so every question was answered with the recommended option; the report says which.

- `spec.md`: acceptance criteria, contract and decisions after SQA's criteria review and the Supervisor's plan check.
- `plan.md`: the two chunks and the role relevance matrix.
- `ledger.md`: every step the orchestrator took, including the Supervisor's corrections.
- `report.md`: what the user saw at Gate 2.

The suite went from 31 to 66 passing tests; the Adversary added 20 attack tests and the Runtime Monitor made 86 requests against the running app.
