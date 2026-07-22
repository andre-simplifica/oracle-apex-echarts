#!/usr/bin/env python3
"""Gerencia a cópia versionada da skill Oracle APEX ECharts."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SKILL_TARGET = PROJECT_ROOT / ".agents" / "skills" / "oracle-apex-echarts"
LOCK_PATH = PROJECT_ROOT / ".oracle-apex-echarts" / "upstream-lock.json"
DEFAULT_REPOSITORY = "andre-simplifica/oracle-apex-echarts"
DEFAULT_SOURCE_PATH = "skills/oracle-apex-echarts"
DEFAULT_REF = "main"
SKIPPED_NAMES = {".DS_Store", "__pycache__"}


class SkillError(RuntimeError):
    """Erro operacional seguro e apresentável ao usuário."""


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def tree_hashes(root: Path) -> dict[str, str]:
    if not root.is_dir():
        raise SkillError(f"Diretório da skill não encontrado: {root}")
    result: dict[str, str] = {}
    for path in sorted(root.rglob("*")):
        if any(part in SKIPPED_NAMES for part in path.relative_to(root).parts):
            continue
        if path.is_symlink():
            raise SkillError(f"Link simbólico não permitido no snapshot: {path}")
        if path.is_file():
            result[path.relative_to(root).as_posix()] = sha256_file(path)
    if "SKILL.md" not in result:
        raise SkillError("Snapshot inválido: SKILL.md não encontrado")
    return result


def read_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SkillError(f"Lock de upstream não encontrado: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SkillError(f"Lock de upstream inválido: {exc}") from exc
    if not isinstance(value, dict):
        raise SkillError("Lock de upstream deve ser um objeto JSON")
    return value


def atomic_write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except BaseException:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def repository_url(repository: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
        raise SkillError(f"Repositório GitHub inválido: {repository}")
    return f"https://github.com/{repository}.git"


def validate_commit(commit: str) -> str:
    commit = commit.strip().lower()
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise SkillError("O commit instalado deve ter 40 caracteres hexadecimais")
    return commit


def load_lock() -> dict:
    lock = read_json(LOCK_PATH)
    required = {
        "schema_version",
        "repository",
        "source_path",
        "tracking_ref",
        "installed_commit",
        "installed_at",
        "files",
    }
    missing = sorted(required - set(lock))
    if missing:
        raise SkillError("Campos ausentes no lock: " + ", ".join(missing))
    validate_commit(str(lock["installed_commit"]))
    if not isinstance(lock["files"], list):
        raise SkillError("files deve ser uma lista no lock de upstream")
    return lock


def expected_hashes(lock: dict) -> dict[str, str]:
    result: dict[str, str] = {}
    for entry in lock["files"]:
        if not isinstance(entry, dict) or set(entry) != {"path", "sha256"}:
            raise SkillError("Entrada de arquivo inválida no lock de upstream")
        path = str(entry["path"])
        checksum = str(entry["sha256"])
        if path.startswith("/") or ".." in Path(path).parts:
            raise SkillError(f"Caminho inseguro no lock: {path}")
        if not re.fullmatch(r"[0-9a-f]{64}", checksum):
            raise SkillError(f"Checksum inválido no lock: {path}")
        result[path] = checksum
    return result


def snapshot_diff(expected: dict[str, str], actual: dict[str, str]) -> dict[str, list[str]]:
    return {
        "missing": sorted(set(expected) - set(actual)),
        "added": sorted(set(actual) - set(expected)),
        "changed": sorted(path for path in set(expected) & set(actual) if expected[path] != actual[path]),
    }


def require_clean_snapshot(lock: dict) -> dict[str, str]:
    actual = tree_hashes(SKILL_TARGET)
    differences = snapshot_diff(expected_hashes(lock), actual)
    if any(differences.values()):
        details = []
        for label in ("missing", "added", "changed"):
            details.extend(f"{label}: {path}" for path in differences[label])
        raise SkillError(
            "A cópia local da skill divergiu do lock. Revise ou restaure antes de atualizar:\n- "
            + "\n- ".join(details)
        )
    return actual


def run_git(arguments: list[str], cwd: Path) -> str:
    try:
        completed = subprocess.run(
            ["git", *arguments],
            cwd=cwd,
            check=True,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except FileNotFoundError as exc:
        raise SkillError("git não está disponível no PATH") from exc
    except subprocess.CalledProcessError as exc:
        message = (exc.stderr or exc.stdout or str(exc)).strip()
        raise SkillError(f"Falha no git: {message}") from exc
    return completed.stdout.strip()


@contextmanager
def fetched_snapshot(repository: str, source_path: str, ref: str) -> Iterator[tuple[Path, str]]:
    if not ref or ref.startswith("-") or any(char.isspace() for char in ref):
        raise SkillError(f"Referência Git inválida: {ref!r}")
    if source_path.startswith("/") or ".." in Path(source_path).parts:
        raise SkillError(f"Caminho de origem inseguro: {source_path}")
    with tempfile.TemporaryDirectory(prefix="oae-upstream-") as temporary:
        checkout = Path(temporary) / "repository"
        checkout.mkdir()
        run_git(["init", "--quiet"], checkout)
        run_git(["remote", "add", "origin", repository_url(repository)], checkout)
        run_git(["fetch", "--quiet", "--depth", "1", "origin", ref], checkout)
        commit = validate_commit(run_git(["rev-parse", "FETCH_HEAD"], checkout))
        run_git(["checkout", "--quiet", "--detach", "FETCH_HEAD"], checkout)
        source = checkout / source_path
        tree_hashes(source)
        yield source, commit


def build_lock(repository: str, source_path: str, tracking_ref: str, commit: str, hashes: dict[str, str]) -> dict:
    return {
        "schema_version": "1.0",
        "repository": repository,
        "source_path": source_path,
        "tracking_ref": tracking_ref,
        "installed_commit": validate_commit(commit),
        "installed_at": utc_now(),
        "files": [
            {"path": path, "sha256": checksum}
            for path, checksum in sorted(hashes.items())
        ],
    }


def print_changes(current: dict[str, str], candidate: dict[str, str]) -> None:
    differences = snapshot_diff(current, candidate)
    for path in differences["added"]:
        print(f"CREATE {path}")
    for path in differences["changed"]:
        print(f"UPDATE {path}")
    for path in differences["missing"]:
        print(f"DELETE {path}")
    if not any(differences.values()):
        print("UNCHANGED snapshot")


def replace_snapshot(source: Path, lock: dict, commit: str, tracking_ref: str) -> None:
    parent = SKILL_TARGET.parent
    parent.mkdir(parents=True, exist_ok=True)
    staging_root = Path(tempfile.mkdtemp(prefix=".oae-staging-", dir=parent))
    staging = staging_root / SKILL_TARGET.name
    backup = parent / f".{SKILL_TARGET.name}.backup"
    if backup.exists():
        shutil.rmtree(staging_root)
        raise SkillError(f"Backup pendente encontrado: {backup}")
    try:
        shutil.copytree(source, staging, symlinks=False)
        hashes = tree_hashes(staging)
        os.replace(SKILL_TARGET, backup)
        try:
            os.replace(staging, SKILL_TARGET)
            new_lock = build_lock(
                repository=str(lock["repository"]),
                source_path=str(lock["source_path"]),
                tracking_ref=tracking_ref,
                commit=commit,
                hashes=hashes,
            )
            atomic_write_json(LOCK_PATH, new_lock)
        except BaseException:
            if SKILL_TARGET.exists():
                shutil.rmtree(SKILL_TARGET)
            os.replace(backup, SKILL_TARGET)
            raise
        shutil.rmtree(backup)
    finally:
        shutil.rmtree(staging_root, ignore_errors=True)


def command_init_lock(args: argparse.Namespace) -> None:
    if LOCK_PATH.exists() and not args.force:
        raise SkillError("O lock já existe; use --force somente após revisão explícita")
    hashes = tree_hashes(SKILL_TARGET)
    lock = build_lock(
        repository=args.repository,
        source_path=args.source_path,
        tracking_ref=args.ref,
        commit=args.commit,
        hashes=hashes,
    )
    atomic_write_json(LOCK_PATH, lock)
    print(f"OK: snapshot registrado em {LOCK_PATH.relative_to(PROJECT_ROOT)}")


def command_status(_: argparse.Namespace) -> None:
    lock = load_lock()
    hashes = require_clean_snapshot(lock)
    print(f"OK: skill íntegra em {SKILL_TARGET.relative_to(PROJECT_ROOT)}")
    print(f"Commit instalado: {lock['installed_commit']}")
    print(f"Arquivos controlados: {len(hashes)}")


def command_check(args: argparse.Namespace) -> None:
    lock = load_lock()
    current = require_clean_snapshot(lock)
    ref = args.ref or str(lock["tracking_ref"])
    with fetched_snapshot(str(lock["repository"]), str(lock["source_path"]), ref) as (source, commit):
        candidate = tree_hashes(source)
        print(f"Commit instalado: {lock['installed_commit']}")
        print(f"Commit disponível ({ref}): {commit}")
        print_changes(current, candidate)
        if commit == lock["installed_commit"] and current == candidate:
            print("OK: skill atualizada")
        else:
            print("ATUALIZAÇÃO DISPONÍVEL")


def command_update(args: argparse.Namespace) -> None:
    lock = load_lock()
    current = require_clean_snapshot(lock)
    ref = args.ref or str(lock["tracking_ref"])
    with fetched_snapshot(str(lock["repository"]), str(lock["source_path"]), ref) as (source, commit):
        candidate = tree_hashes(source)
        print_changes(current, candidate)
        print(f"Commit candidato: {commit}")
        if args.dry_run:
            print("DRY-RUN: nenhum arquivo foi alterado")
            return
        if commit == lock["installed_commit"] and current == candidate:
            print("OK: skill já está atualizada")
            return
        replace_snapshot(source, lock, commit, ref)
    print(f"OK: skill atualizada para {commit}")


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    subparsers = result.add_subparsers(dest="command", required=True)

    init_lock = subparsers.add_parser("init-lock", help="registra uma instalação inicial já verificada")
    init_lock.add_argument("--commit", required=True)
    init_lock.add_argument("--ref", default=DEFAULT_REF)
    init_lock.add_argument("--repository", default=DEFAULT_REPOSITORY)
    init_lock.add_argument("--source-path", default=DEFAULT_SOURCE_PATH)
    init_lock.add_argument("--force", action="store_true")
    init_lock.set_defaults(handler=command_init_lock)

    status = subparsers.add_parser("status", help="confere integridade sem acessar a rede")
    status.set_defaults(handler=command_status)

    check = subparsers.add_parser("check", help="compara com uma referência remota")
    check.add_argument("--ref")
    check.set_defaults(handler=command_check)

    update = subparsers.add_parser("update", help="atualiza a cópia vendorizada com proteção contra drift")
    update.add_argument("--ref")
    update.add_argument("--dry-run", action="store_true")
    update.set_defaults(handler=command_update)
    return result


def main() -> int:
    try:
        arguments = parser().parse_args()
        arguments.handler(arguments)
        return 0
    except (SkillError, OSError) as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
