# ToThread
ToDo, ToRead, ToWrite, To work on threads like a student or an LLM under training.

## Plan API Test Script

The backend includes a plan task CRUD API and a test script to validate it end‑to‑end.

### Prerequisites

- Deploy the backend (`webApp/backend`) to your Worker.
- Obtain a Google ID token (same one used for `/writings`).

### Run Tests

```bash
export GOOGLE_TOKEN="<YOUR_GOOGLE_ID_TOKEN>"
webApp/backend/scripts/test-plan-endpoints.sh
```

Optional: override the base URL (if not default):

```bash
BASE_URL="https://tothread-webapp.zhian-job.workers.dev" \
  webApp/backend/scripts/test-plan-endpoints.sh
```
