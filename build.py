import argparse
import os
import platform
import shutil
import subprocess

ROOT = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(ROOT, "apps", "electron")
ENGINE_BUILD_DIR = os.path.join(ROOT, "build", "engine")
IS_WINDOWS = platform.system() == "Windows"
NPM = "npm.cmd" if IS_WINDOWS else "npm"

WINDOWS_VS_ROOTS = (
    r"C:\Program Files\Microsoft Visual Studio\2022\Community",
    r"C:\Program Files\Microsoft Visual Studio\2022\Professional",
    r"C:\Program Files\Microsoft Visual Studio\2022\Enterprise",
)

def run(cmd, cwd, env=None):
    print(">", " ".join(cmd))
    subprocess.run(cmd, cwd=cwd, env=env, check=True)

def find_tool(name):
    found = shutil.which(name)
    if found:
        return found

    if IS_WINDOWS and name == "ninja":
        for root in WINDOWS_VS_ROOTS:
            candidate = os.path.join(root, "Common7", "IDE", "CommonExtensions", "Microsoft", "CMake", "Ninja", "ninja.exe")
            if os.path.exists(candidate):
                return candidate

    raise RuntimeError(f"Required build tool was not found: {name}")

def engine_build_environment():
    if not IS_WINDOWS or shutil.which("cl.exe"):
        return None

    for root in WINDOWS_VS_ROOTS:
        vcvars = os.path.join(root, "VC", "Auxiliary", "Build", "vcvars64.bat")
        if not os.path.exists(vcvars):
            continue

        output = subprocess.check_output(
            f'call "{vcvars}" >nul && set',
            shell=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        environment = os.environ.copy()
        for line in output.splitlines():
            if "=" in line:
                key, value = line.split("=", 1)
                environment[key] = value
        return environment

    raise RuntimeError("Visual Studio C++ build environment was not found")

def main():
    parser = argparse.ArgumentParser(description="Build the RawElectron engine and desktop app.")
    parser.add_argument("--config", choices=("Debug", "Release"), default="Release")
    parser.add_argument("--skip-app", action="store_true")
    parser.add_argument("--skip-engine", action="store_true")
    args = parser.parse_args()

    if not args.skip_engine:
        cmake = find_tool("cmake")
        ninja = find_tool("ninja")
        build_env = engine_build_environment()
        run([
            cmake, "-S", ROOT, "-B", ENGINE_BUILD_DIR, "-G", "Ninja",
            f"-DCMAKE_MAKE_PROGRAM={ninja}",
            f"-DCMAKE_BUILD_TYPE={args.config}",
        ], ROOT, build_env)
        run([cmake, "--build", ENGINE_BUILD_DIR], ROOT, build_env)

    if args.skip_app:
        return

    find_tool(NPM)
    if not os.path.exists(os.path.join(APP_DIR, "node_modules")):
        run([NPM, "install"], APP_DIR)

    run([NPM, "run", "build:native"], APP_DIR)
    run([NPM, "run", "make"], APP_DIR)

if __name__ == "__main__":
    main()
