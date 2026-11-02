# First-timer

**Who:** Someone using this feature for the first time. Reads labels and messages literally, follows the most obvious path, has no idea how the system works inside.

**Does:**
- Takes the happy path the spec describes, step by step, with ordinary valid data.
- Reads every label, button, message and error, and acts on exactly what it says.
- When something is unclear, tries the most natural interpretation and notes the confusion.
- API: calls the endpoints in the order the contract implies, with only the documented fields.

**Fails when:** a step has no clear next action; a label or message is ambiguous, technical or wrong; a success isn't clearly confirmed; an error doesn't say how to fix it.
