### Completed plan cards expose implement action

#### Feature/Change Name
The latest completed plan card exposes direct execution and an inline Plan-mode revision field.

#### Prerequisites/Setup
1. Dev server running at `http://127.0.0.1:4173`
2. An existing thread contains a completed persisted plan card
3. The thread composer is available for follow-up messages

#### Steps
1. Open a thread containing a completed plan card
2. Verify the plan card shows `执行计划` and the `输入修改意见` field at the bottom
3. Enter a revision request and submit it
4. Confirm the next `turn/start` remains in Plan mode and a replacement plan is generated
5. On the latest replacement plan, click `执行计划`
6. Confirm the composer thread switches back to default mode and sends `Implement`
7. Confirm older plan cards no longer expose either action

#### Expected Results
- Only the latest actionable completed plan exposes controls
- Revision text is sent as a Plan-mode follow-up and produces a new plan
- Clicking `执行计划` sends a simple `Implement` follow-up without a second confirmation
- The implementation turn runs in default mode rather than plan mode
- Light and dark themes keep the plan body, controls, focus state, and disabled submit state readable

#### Rollback/Cleanup
- Archive or delete any test thread created only for this check

---
