# Submission deadlines

- GHG collection periods and ESG metric requests accept data through 23:59:59.999 on `dueDate` in Asia/Seoul (UTC+09:00).
- `canCollect` is shared by the workspace API and client save handlers. Editor API validation uses the authoritative global request, not the editor's submitted request settings.
- Expired collection requests are displayed as submission-closed / under review. This derived status does not require a scheduled job or overwrite settings during clock refreshes.
- Open pages refresh on Korean date changes and focus. Final save handlers recheck real time, including already-open confirmation dialogs and bulk entry/import.
- Admin review and approval remain possible. New or modified pending submissions are rejected after closure, including admin submissions.
- To reopen, extend the deadline and explicitly choose `수집중` (GHG: save settings, then `기간 다시 열기`). Legacy requests with no date retain their manual status behavior.

Validation: deadline boundary and extension unit tests; TypeScript; production build; isolated React DOM tests for midnight crossing in a pending confirmation, automatic task action closure, and existing draft/submit flows. Live authenticated browser tests were not performed (browser execution is restricted in this environment).
