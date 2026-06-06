from pathlib import Path

PROJECT_ROOT: Path = Path(__file__).resolve().parents[3]

DATA_DIR: Path = PROJECT_ROOT / "data"
BENCHMARKS_DIR: Path = DATA_DIR / "benchmarks"
RESULTS_DIR: Path = DATA_DIR / "results"
STATE_DIR: Path = DATA_DIR / "state"
