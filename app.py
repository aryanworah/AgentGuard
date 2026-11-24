from __future__ import annotations

import json
import re
from typing import Any

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

app = FastAPI(title="AgentGuard API", version="1.0.0")


class VerifyRequest(BaseModel):
    response: str
    required_fields: list[str] = Field(default_factory=lambda: ["name", "age", "email", "status"])
    expected_types: dict[str, str] = Field(default_factory=lambda: {"name": "string", "age": "number", "email": "string", "status": "string"})
    expected_values: dict[str, Any] = Field(default_factory=lambda: {"status": "success"})


def check_type(value: Any, expected: str) -> bool:
    return {
        "string": lambda v: isinstance(v, str),
        "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
        "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
        "boolean": lambda v: isinstance(v, bool),
        "array": lambda v: isinstance(v, list),
        "object": lambda v: isinstance(v, dict),
    }.get(expected, lambda _v: False)(value)


@app.post("/api/verify")
def verify(payload: VerifyRequest):
    raw = payload.response.strip()
    if not raw:
        return {"status": "FAIL", "total": 1, "passed": 0, "failed": 1, "checks": [{"name": "JSON structure", "status": "FAIL", "detail": "Response is empty.", "recommendation": "Paste a JSON object to verify."}], "data": None}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        return {"status": "FAIL", "total": 1, "passed": 0, "failed": 1, "checks": [{"name": "JSON structure", "status": "FAIL", "detail": f"Invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}.", "recommendation": "Fix the JSON syntax, then run the verification again."}], "data": None}

    checks = []
    def add(name: str, ok: bool, detail: str, recommendation: str):
        checks.append({"name": name, "status": "PASS" if ok else "FAIL", "detail": detail, "recommendation": recommendation if not ok else "Looks good."})

    is_object = isinstance(data, dict)
    add("JSON structure", is_object, "Response is a JSON object." if is_object else "Top-level JSON value must be an object.", "Return one JSON object at the top level.")
    if is_object:
        missing = [key for key in payload.required_fields if key not in data]
        add("Required fields", not missing, "All required fields are present." if not missing else f"Missing: {', '.join(missing)}.", "Add every required field to the response.")
        type_errors = [f"{key} should be {kind}, got {type(data[key]).__name__}" for key, kind in payload.expected_types.items() if key in data and not check_type(data[key], kind)]
        add("Data types", not type_errors, "All configured field types match." if not type_errors else "; ".join(type_errors) + ".", "Match each field to its configured type.")
        email = data.get("email")
        email_ok = email is None or (isinstance(email, str) and re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email) is not None)
        add("Email validation", email_ok, "Email format is valid." if email_ok else "Email address is missing or malformed." if email is None else "Email address is malformed.", "Use a valid address such as name@example.com.")
        mismatches = [f"{key} must equal {value!r}" for key, value in payload.expected_values.items() if key in data and data[key] != value]
        add("Expected values", not mismatches, "Configured values match." if not mismatches else "; ".join(mismatches) + ".", "Update the output to use the expected value.")
        known = set(payload.required_fields) | set(payload.expected_types) | set(payload.expected_values)
        extras = [key for key in data if key not in known]
        add("Output consistency", not extras, "No unexpected fields found." if not extras else f"Unexpected fields: {', '.join(extras)}.", "Remove unexpected fields or add them to your schema.")
    passed = sum(item["status"] == "PASS" for item in checks)
    failed = len(checks) - passed
    return {"status": "PASS" if failed == 0 else "FAIL", "total": len(checks), "passed": passed, "failed": failed, "checks": checks, "data": data}


app.mount("/", StaticFiles(directory="static", html=True), name="static")
