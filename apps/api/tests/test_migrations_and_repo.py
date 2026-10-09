"""Migrations match the models; no secrets or .env tracked by git (rule 10)."""

from __future__ import annotations

import re
import shutil
import subprocess  # noqa: S404  (fixed git commands, no user input)
from pathlib import Path

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine

from app.models import Base

API_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = API_ROOT.parent.parent
GIT = shutil.which("git") or "/usr/bin/git"


def test_migrations_build_the_same_schema_as_the_models(tmp_path: Path) -> None:
    url = f"sqlite:///{tmp_path / 'm.db'}"
    cfg = Config(str(API_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_ROOT / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")
    engine = create_engine(url)
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    engine.dispose()
    assert diff == []


def _git(*args: str) -> str:
    return subprocess.run(  # noqa: S603
        [GIT, *args],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout


def test_no_env_file_is_tracked() -> None:
    tracked = _git("ls-files").splitlines()
    assert not [p for p in tracked if Path(p).name == ".env" or p.endswith("/.env")]


def test_env_files_are_ignored() -> None:
    for path in (".env", "apps/api/.env", "apps/web/.env.local"):
        result = subprocess.run(  # noqa: S603
            [GIT, "check-ignore", "-q", path],
            cwd=REPO_ROOT,
            check=False,
        )
        assert result.returncode == 0, path


def test_env_example_has_only_placeholders() -> None:
    example = (REPO_ROOT / ".env.example").read_text(encoding="utf-8")
    secret_names = ("ANTHROPIC_API_KEY", "WHATSAPP_TOKEN", "RAZORPAY_KEY_SECRET",
                    "PROOF_PRIVATE_KEY")  # fmt: skip
    for name in secret_names:
        match = re.search(rf"^{name}=(.*)$", example, re.MULTILINE)
        assert match is not None, name
        assert match.group(1).strip() == "", f"{name} must be empty in .env.example"
