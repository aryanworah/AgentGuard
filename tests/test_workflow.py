import os
import subprocess
import time

import pytest
from playwright.sync_api import sync_playwright


@pytest.fixture(scope="module")
def page():
    proc = subprocess.Popen(["uvicorn", "app:app", "--host", "127.0.0.1", "--port", "8765"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            for _ in range(50):
                try:
                    page.goto("http://127.0.0.1:8765", wait_until="domcontentloaded", timeout=1000)
                    break
                except Exception:
                    time.sleep(.2)
            yield page
            browser.close()
    finally:
        proc.terminate()
        proc.wait(timeout=5)


def test_sample_verifies_and_invalid_response_fails(page):
    page.get_by_role("button", name="Run verification").click()
    page.get_by_text("ALL CHECKS PASSED").wait_for()
    page.get_by_label("Agent response").fill('{"name":"John","age":"25","email":"bad","status":"error"}')
    page.get_by_role("button", name="Run verification").click()
    page.get_by_text("REVIEW REQUIRED").wait_for()
    assert page.locator(".check-row.fail").count() >= 2
