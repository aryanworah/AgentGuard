# AgentGuard

AgentGuard checks AI agent JSON responses against a configurable schema and returns a PASS/FAIL report with field-level details and recommendations.

## Run locally

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --reload
```

Open <http://127.0.0.1:8000>. The API is documented at <http://127.0.0.1:8000/docs>.

## Browser workflow test

Install the dependencies above, then install a Playwright browser once:

```powershell
playwright install chromium
pytest
```

The browser test launches the local FastAPI server, submits the passing sample, then submits an invalid response and checks that failures appear.

## API

`POST /api/verify` accepts a `response` string and optional `required_fields`, `expected_types`, and `expected_values` maps. Supported types are `string`, `number`, `integer`, `boolean`, `array`, and `object`.
