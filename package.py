"""Create a platform-native RawElectron desktop distribution.

Run this script on the operating system being targeted. Electron and the native
image engine are packaged from ``apps/electron``; cross-compiling is deliberately
rejected because the bundled native libraries are platform-specific.
"""

import argparse
import os
import platform
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent
APP_DIR = ROOT / "apps" / "electron"
OUT_DIR = APP_DIR / "out" / "make"
INSTALLER_DIR = ROOT / "installer"
HOST_SYSTEM = platform.system()
NPM = "npm.cmd" if HOST_SYSTEM == "Windows" else "npm"


def run(command: list[str]) -> None:
    print(">", " ".join(command), flush=True)
    subprocess.run(command, cwd=APP_DIR, check=True)


def normalized_host() -> str:
    if HOST_SYSTEM == "Windows":
        return "windows"
    if HOST_SYSTEM == "Darwin":
        return "macos"
    raise RuntimeError(f"Packaging is not configured for {HOST_SYSTEM}")


def default_architecture() -> str:
    machine = platform.machine().lower()
    if machine in ("arm64", "aarch64"):
        return "arm64"
    return "x64"


def ensure_prerequisites() -> None:
    if shutil.which(NPM) is None:
        raise RuntimeError("npm was not found. Install Node.js before packaging.")
    if not (APP_DIR / "node_modules").is_dir():
        run([NPM, "install"])


def package_windows(arch: str) -> None:
    if arch != "x64":
        raise RuntimeError("The Windows native engine is currently configured for x64 only.")
    run([NPM, "run", "make:win"])


def package_macos(arch: str) -> None:
    # Keep macOS-specific signing, notarization, and DMG steps in this function.
    run([NPM, "run", "make:mac", "--", f"--arch={arch}"])


def collect_artifacts(target: str, arch: str) -> list[Path]:
    artifact_root = (
        OUT_DIR / "zip" / "win32" / arch
        if target == "windows"
        else OUT_DIR / "zip" / "darwin" / arch
    )
    artifacts = sorted(path for path in artifact_root.rglob("*") if path.is_file())
    if not artifacts:
        raise RuntimeError(f"Packaging completed but no artifacts were found under {artifact_root}")

    INSTALLER_DIR.mkdir(exist_ok=True)
    collected: list[Path] = []
    for artifact in artifacts:
        suffix = artifact.suffix
        platform_name = "Windows" if target == "windows" else "macOS"
        destination_name = f"RawElectron-{platform_name}-{arch}{suffix}"
        destination = INSTALLER_DIR / destination_name
        shutil.copy2(artifact, destination)
        collected.append(destination)

    print("\nCreated installers:")
    for artifact in collected:
        print(f"- {artifact.relative_to(ROOT)} ({artifact.stat().st_size:,} bytes)")
    return collected


def main() -> None:
    host = normalized_host()
    parser = argparse.ArgumentParser(
        description="Create a RawElectron installer/package for the current operating system."
    )
    parser.add_argument(
        "--platform",
        choices=("auto", "windows", "macos"),
        default="auto",
        help="Target platform; cross-platform native packaging is not supported.",
    )
    parser.add_argument(
        "--arch",
        choices=("x64", "arm64"),
        default=default_architecture(),
        help="Target CPU architecture (default: current host architecture).",
    )
    args = parser.parse_args()
    target = host if args.platform == "auto" else args.platform
    if target != host:
        parser.error(f"{target} packages must be built on {target}; current host is {host}")

    ensure_prerequisites()
    if target == "windows":
        package_windows(args.arch)
    else:
        package_macos(args.arch)
    collect_artifacts(target, args.arch)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(f"Packaging failed: {error}", flush=True)
        raise SystemExit(1) from error
