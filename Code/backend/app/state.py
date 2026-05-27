
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_STATE_DIR = _PROJECT_ROOT / "data" / "state"
_CURRENT_PAPER_PATH = _STATE_DIR / "current_paper.json"


def save_current_paper(payload: dict[str, Any]) -> dict[str, Any]:
  
    _STATE_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        **payload,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    _CURRENT_PAPER_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def load_current_paper() -> dict[str, Any] | None:
    if not _CURRENT_PAPER_PATH.exists():
        return None
    return json.loads(_CURRENT_PAPER_PATH.read_text(encoding="utf-8"))


def clear_current_paper() -> None:
    if _CURRENT_PAPER_PATH.exists():
        _CURRENT_PAPER_PATH.unlink()
