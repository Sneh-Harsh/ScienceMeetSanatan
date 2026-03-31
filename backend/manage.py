#!/usr/bin/env python
import os
import sys
from pathlib import Path


def main() -> None:
    # Allow running Django from /backend while using the existing project at repo root.
    repo_root = Path(__file__).resolve().parent.parent
    sys.path.insert(0, str(repo_root))

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "gita_site.settings")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()

