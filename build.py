import argparse
import glob
import os
import platform
import shutil
import subprocess

ROOT = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(ROOT, "apps", "electron")
ENGINE_BUILD_DIR = os.path.join(ROOT, "build", "engine")
NASM_SOURCE_DIR = os.path.join(ROOT, "third_party", "nasm")
OPENCV_SOURCE_DIR = os.path.join(ROOT, "third_party", "opencv")
TOOLS_BUILD_DIR = os.path.join(ROOT, "build", "tools")
IS_WINDOWS = platform.system() == "Windows"
IS_MACOS = platform.system() == "Darwin"
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

def ensure_vendored_nasm(environment):
    machine = platform.machine().lower()
    if not IS_WINDOWS and machine not in ("x86_64", "amd64"):
        return environment

    nasm = os.path.join(NASM_SOURCE_DIR, "nasm.exe") if IS_WINDOWS else None
    if not os.path.exists(os.path.join(NASM_SOURCE_DIR, "CMakeLists.txt")):
        raise RuntimeError(f"Vendored NASM source was not found: {NASM_SOURCE_DIR}")

    if IS_WINDOWS and not os.path.exists(nasm):
        search_path = (environment or os.environ).get("PATH", os.environ.get("PATH", ""))
        nmake = shutil.which("nmake", path=search_path)
        if not nmake:
            candidates = []
            for root in WINDOWS_VS_ROOTS:
                candidates.extend(glob.glob(os.path.join(
                    root, "VC", "Tools", "MSVC", "*", "bin", "Hostx64", "x64", "nmake.exe"
                )))
            if not candidates:
                raise RuntimeError("Visual Studio x64 nmake.exe was not found")
            nmake = sorted(candidates)[-1]
        run([nmake, "/f", "Mkfiles/msvc.mak"], NASM_SOURCE_DIR, environment)
    elif not IS_WINDOWS:
        cmake = find_tool("cmake")
        ninja = find_tool("ninja")
        nasm_build_dir = os.path.join(TOOLS_BUILD_DIR, "nasm")
        run([
            cmake, "-S", NASM_SOURCE_DIR, "-B", nasm_build_dir, "-G", "Ninja",
            f"-DCMAKE_MAKE_PROGRAM={ninja}", "-DCMAKE_BUILD_TYPE=Release",
        ], ROOT, environment)
        run([cmake, "--build", nasm_build_dir, "--target", "nasm"], ROOT, environment)
        matches = glob.glob(os.path.join(nasm_build_dir, "**", "nasm"), recursive=True)
        if not matches:
            raise RuntimeError("Vendored NASM build completed but the nasm executable was not found")
        nasm = matches[0]

    environment = (environment or os.environ).copy()
    path_value = next((value for key, value in environment.items() if key.lower() == "path"), "")
    for key in [key for key in environment if key.lower() == "path"]:
        del environment[key]
    environment["PATH"] = os.path.dirname(nasm) + os.pathsep + path_value
    return environment

def opencv_install_dir():
    if IS_WINDOWS:
        return os.path.join(OPENCV_SOURCE_DIR, "install")
    system = "macos" if IS_MACOS else platform.system().lower()
    machine = platform.machine().lower().replace("x86_64", "x64").replace("aarch64", "arm64")
    return os.path.join(OPENCV_SOURCE_DIR, "install", f"{system}-{machine}")

def opencv_is_installed(install_dir):
    configs = glob.glob(os.path.join(install_dir, "**", "OpenCVConfig.cmake"), recursive=True)
    headers = os.path.exists(os.path.join(install_dir, "include", "opencv2", "opencv.hpp"))
    return bool(configs and headers)

def ensure_vendored_opencv(environment, config):
    install_dir = opencv_install_dir()
    if opencv_is_installed(install_dir):
        return install_dir
    if not os.path.exists(os.path.join(OPENCV_SOURCE_DIR, "CMakeLists.txt")):
        raise RuntimeError(f"Vendored OpenCV source was not found: {OPENCV_SOURCE_DIR}")

    cmake = find_tool("cmake")
    ninja = find_tool("ninja")
    system = "windows" if IS_WINDOWS else ("macos" if IS_MACOS else platform.system().lower())
    machine = platform.machine().lower().replace("x86_64", "x64").replace("aarch64", "arm64")
    build_dir = os.path.join(OPENCV_SOURCE_DIR, "build", f"{system}-{machine}")
    run([
        cmake, "-S", OPENCV_SOURCE_DIR, "-B", build_dir, "-G", "Ninja",
        f"-DCMAKE_MAKE_PROGRAM={ninja}", f"-DCMAKE_BUILD_TYPE={config}",
        f"-DCMAKE_INSTALL_PREFIX={install_dir}",
        "-DBUILD_LIST=core,imgcodecs,imgproc", "-DBUILD_SHARED_LIBS=ON",
        "-DBUILD_TESTS=OFF", "-DBUILD_PERF_TESTS=OFF", "-DBUILD_EXAMPLES=OFF",
        "-DBUILD_DOCS=OFF", "-DBUILD_opencv_apps=OFF", "-DBUILD_JAVA=OFF",
        "-DBUILD_opencv_gapi=OFF", "-DBUILD_opencv_python_bindings_generator=OFF",
        "-DOPENCV_PYTHON_SKIP_DETECTION=ON", "-DWITH_FFMPEG=OFF", "-DWITH_IPP=OFF",
    ], ROOT, environment)
    run([cmake, "--build", build_dir, "--target", "install"], ROOT, environment)
    if not opencv_is_installed(install_dir):
        raise RuntimeError(f"OpenCV installation was not created: {install_dir}")
    return install_dir

def main():
    parser = argparse.ArgumentParser(description="Build the RawElectron engine and desktop app.")
    parser.add_argument("--config", choices=("Debug", "Release"), default="Release")
    parser.add_argument("--skip-app", action="store_true")
    parser.add_argument("--skip-engine", action="store_true")
    args = parser.parse_args()

    build_env = engine_build_environment()
    build_env = ensure_vendored_nasm(build_env)
    opencv_dir = ensure_vendored_opencv(build_env, args.config)
    build_env = (build_env or os.environ).copy()
    build_env["RAWELECTRON_OPENCV_DIR"] = opencv_dir

    if not args.skip_engine:
        cmake = find_tool("cmake")
        ninja = find_tool("ninja")
        run([
            cmake, "-S", ROOT, "-B", ENGINE_BUILD_DIR, "-G", "Ninja",
            f"-DCMAKE_MAKE_PROGRAM={ninja}",
            f"-DCMAKE_BUILD_TYPE={args.config}",
            f"-DRAWELECTRON_OPENCV_INSTALL_DIR={opencv_dir}",
        ], ROOT, build_env)
        run([cmake, "--build", ENGINE_BUILD_DIR], ROOT, build_env)

    if args.skip_app:
        return

    find_tool(NPM)
    if not os.path.exists(os.path.join(APP_DIR, "node_modules")):
        run([NPM, "install"], APP_DIR, build_env)

    run([NPM, "run", "build:native"], APP_DIR, build_env)
    run([NPM, "run", "make"], APP_DIR, build_env)

if __name__ == "__main__":
    main()
