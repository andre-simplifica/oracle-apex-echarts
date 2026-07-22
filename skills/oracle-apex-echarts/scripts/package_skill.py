#!/usr/bin/env python3
"""Create a deterministic ZIP of this skill using only the Python standard library."""

from __future__ import annotations

import argparse
import stat
import zipfile
from pathlib import Path


FIXED_TIME = (2000, 1, 1, 0, 0, 0)
SKIP = {".DS_Store", "__pycache__"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    skill = Path(__file__).resolve().parents[1]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(skill.rglob("*")):
            relative = path.relative_to(skill)
            if any(part in SKIP for part in relative.parts) or path.is_dir():
                continue
            if path.is_symlink():
                raise RuntimeError(f"symbolic link is not allowed: {relative}")
            info = zipfile.ZipInfo(f"oracle-apex-echarts/{relative.as_posix()}", FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (stat.S_IFREG | (0o755 if path.suffix == ".py" else 0o644)) << 16
            archive.writestr(info, path.read_bytes())
    print(f"OK: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
