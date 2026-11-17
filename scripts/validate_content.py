"""Validate daily content files.

Usage: python scripts/validate_content.py content/            (a folder or a single file)
Exits with status 1 and lists every problem if any file is invalid.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.content import ContentError, content_files, read_day_file  # noqa: E402


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    target = Path(argv[1])
    if not target.exists():
        print(f"{target} doesn't exist", file=sys.stderr)
        return 2
    files = content_files(target)
    if not files:
        print(f"No .yaml files in {target}", file=sys.stderr)
        return 1
    failed = 0
    for path in files:
        try:
            spec = read_day_file(path)
        except ContentError as error:
            failed += 1
            print(f"FAIL {path}")
            for problem in error.problems:
                print(f"  - {problem}")
        else:
            print(f"ok   {path} ({spec.date}, {len(spec.questions)} questions)")
    print(f"{len(files) - failed} valid, {failed} invalid")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
