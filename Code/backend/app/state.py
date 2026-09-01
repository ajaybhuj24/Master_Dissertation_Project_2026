
import json
from datetime import datetime, timezone
from typing import Any

from .paths import STATE_DIR

_CURRENT_PAPER_PATH = STATE_DIR / "current_paper.json"

# Persist metadata for the currently-loaded paper
def save_current_paper(payload: dict[str, Any]) -> dict[str, Any]:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        **payload,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    _CURRENT_PAPER_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload

# Read the current-paper record,
def load_current_paper() -> dict[str, Any] | None:
    if not _CURRENT_PAPER_PATH.exists():
        return None
    return json.loads(_CURRENT_PAPER_PATH.read_text(encoding="utf-8"))

# Remove the current-paper record
def clear_current_paper() -> None:
    if _CURRENT_PAPER_PATH.exists():
        _CURRENT_PAPER_PATH.unlink()
