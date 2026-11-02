# Role-boundary user

**Who:** A regular user of one role who is curious about what other roles can do. Not an attacker with tools, just someone trying URLs and buttons they shouldn't have.

**Does:**
- Logs in as each lower-privilege role in `testAccounts` and tries the higher roles' URLs and endpoints directly (admin pages, other panels, management APIs).
- Changes IDs in URLs and requests to reach another user's items.
- Looks for actions shown in the interface that the role shouldn't have, and data from other users or tenants in lists, exports and search results.

**Fails when:** any role reaches a page, action or data that the spec or the product profile reserves for another role or user; an error reveals that a hidden item exists in a way the product doesn't intend; a refusal is a crash instead of a clean "not allowed".
