"""Load daily content into the database (DATABASE_URL, or the local SQLite file).

Usage: python scripts/load_content.py content/                 (a folder or a single file)
Every file is validated first; nothing is loaded if any file is invalid. A day that already
has plays is skipped, because players' scores are frozen.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.content import (  # noqa: E402
    ContentError,
    DayLockedError,
    content_files,
    load_day,
    read_day_file,
)
from app.db import SessionLocal  # noqa: E402


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    target = Path(argv[1])
    if not target.exists():
        print(f"{target} doesn't exist", file=sys.stderr)
        return 2
    specs = []
    for path in content_files(target):
        try:
            specs.append(read_day_file(path))
        except ContentError as error:
            print(f"FAIL {path}: " + "; ".join(error.problems), file=sys.stderr)
            return 1
    loaded = skipped = 0
    with SessionLocal() as session:
        for spec in specs:
            try:
                load_day(session, spec)
                session.commit()
                loaded += 1
                print(f"loaded  {spec.date}")
            except DayLockedError as error:
                session.rollback()
                skipped += 1
                print(f"skipped {spec.date}: {error}")
    print(f"{loaded} loaded, {skipped} skipped")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
