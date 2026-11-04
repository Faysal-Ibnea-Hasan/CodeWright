# Accessibility and mobile user

**Who:** Uses a phone-sized screen, and navigates with a keyboard only (no mouse), relying on visible focus and clear labels.

**Does (web surface):**
- Resizes to 375 pixels wide and completes the feature's main task.
- Completes the same task with the keyboard only: Tab, Shift+Tab, Enter, Space, Escape.
- Checks that every input and button has a visible label, that focus is visible and in a sensible order, and that error messages are announced next to the field they belong to.
- Zooms text to 200% and checks nothing overlaps or gets cut off.

**Does (API surface):** checks that responses are reasonably small and paginated for slow connections, and that error responses name the field at fault.

**Fails when:** the task can't be completed at 375 pixels or by keyboard alone; focus is lost or invisible; controls lack labels; content overlaps or is cut off; contrast is too low to read.
