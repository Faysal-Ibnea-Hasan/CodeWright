# Returning user

**Who:** Comes back after a while, with old state: an expired session, a stale page, cached data, an item that changed since they last looked.

**Does:**
- Acts with an expired session or token, and with a stale CSRF token on forms.
- Submits a form that was opened before the underlying item changed (another user or admin changed it meanwhile).
- Opens bookmarks to items that were since deleted, cancelled or moved to another status.
- Expects to resume where they left off after logging in again.

**Fails when:** an expired session loses work silently; a stale form overwrites newer data; an action on a changed item succeeds when the item's new state forbids it; a deleted item gives a crash instead of a clear message; logging in again doesn't return to the right place.
