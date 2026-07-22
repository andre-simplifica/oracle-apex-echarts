#!/usr/bin/env python3
"""Scaffold a guarded, repository-linked Oracle APEX ECharts skill installation."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path


SKILL = Path(__file__).resolve().parents[1]


class ScaffoldError(RuntimeError):
    pass


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def hashes(root: Path) -> list[dict[str, str]]:
    result = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise ScaffoldError(f"symbolic link is not allowed: {path}")
        if path.is_file() and "__pycache__" not in path.parts:
            result.append({"path": path.relative_to(root).as_posix(), "sha256": sha256(path)})
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, required=True)
    parser.add_argument("--commit", required=True, help="verified 40-character upstream commit")
    parser.add_argument("--ref", default="v1.0.0", help="tracking tag or commit")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    try:
        if not re.fullmatch(r"[0-9a-fA-F]{40}", args.commit):
            raise ScaffoldError("--commit must contain 40 hexadecimal characters")
        project = args.project.resolve()
        skill_target = project / ".agents/skills/oracle-apex-echarts"
        config = project / ".oracle-apex-echarts"
        updater = project / "Util/scripts/manage_oracle_apex_echarts.py"
        targets = [
            skill_target,
            config / "profile.yaml",
            config / "upstream-lock.json",
            config / "ONBOARDING-EQUIPE.md",
            updater,
        ]
        for target in targets:
            print(f"CREATE {target.relative_to(project)}")
            if target.exists() or target.is_symlink():
                raise ScaffoldError(f"refusing to overwrite existing path: {target}")
        if not args.apply:
            print("DRY-RUN: no files changed; rerun with --apply after reviewing the paths")
            return 0

        project.mkdir(parents=True, exist_ok=True)
        staging_parent = project / ".agents/skills"
        staging_parent.mkdir(parents=True, exist_ok=True)
        staging_root = Path(tempfile.mkdtemp(prefix=".oracle-apex-echarts-", dir=staging_parent))
        staged_skill = staging_root / "oracle-apex-echarts"
        created: list[Path] = []
        try:
            shutil.copytree(SKILL, staged_skill, symlinks=False, ignore=shutil.ignore_patterns("__pycache__", ".DS_Store"))
            files = hashes(staged_skill)
            os.replace(staged_skill, skill_target)
            created.append(skill_target)
            config.mkdir(parents=True, exist_ok=False)
            created.append(config)
            shutil.copy2(SKILL / "assets/neutral-profile/profile.yaml", config / "profile.yaml")
            shutil.copy2(SKILL / "assets/consumer/ONBOARDING-EQUIPE.md", config / "ONBOARDING-EQUIPE.md")
            updater.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(SKILL / "assets/consumer/manage_oracle_apex_echarts.py", updater)
            created.append(updater)
            lock = {
                "schema_version": "1.0",
                "repository": "andre-simplifica/oracle-apex-echarts",
                "source_path": "skills/oracle-apex-echarts",
                "tracking_ref": args.ref,
                "installed_commit": args.commit.lower(),
                "installed_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                "files": files,
            }
            (config / "upstream-lock.json").write_text(json.dumps(lock, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        except BaseException:
            for path in reversed(created):
                if path.is_dir():
                    shutil.rmtree(path, ignore_errors=True)
                elif path.exists():
                    path.unlink()
            raise
        finally:
            shutil.rmtree(staging_root, ignore_errors=True)
        print("OK: linked skill installation created")
        return 0
    except (OSError, ScaffoldError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
