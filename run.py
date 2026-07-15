import os
import platform
import subprocess

ROOT = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(ROOT, "apps", "electron")
NATIVE_ADDON = os.path.join(APP_DIR, "native", "build", "Release", "rawelectron_engine.node")
IS_WINDOWS = platform.system() == "Windows"
NPM = "npm.cmd" if IS_WINDOWS else "npm"

def run(cmd, cwd):
    print(">", " ".join(cmd), flush=True)
    subprocess.run(cmd, cwd=cwd, check=True)

def native_sources():
    roots = [
        os.path.join(ROOT, "engine"),
        os.path.join(APP_DIR, "src", "native-engine"),
        os.path.join(APP_DIR, "native"),
    ]
    extensions = (".cpp", ".hpp", ".h", ".gyp", ".gypi")
    for source_root in roots:
        for directory, directories, files in os.walk(source_root):
            directories[:] = [name for name in directories if name not in ("build", "node_modules")]
            for name in files:
                if name.endswith(extensions):
                    yield os.path.join(directory, name)

def native_rebuild_required():
    if not os.path.exists(NATIVE_ADDON):
        return True
    addon_time = os.path.getmtime(NATIVE_ADDON)
    return any(os.path.getmtime(source) > addon_time for source in native_sources())

def main():
    if not os.path.exists(os.path.join(APP_DIR, "node_modules")):
        run([NPM, "install"], APP_DIR)

    if native_rebuild_required():
        print("Native engine sources changed; rebuilding the addon.", flush=True)
        run([NPM, "run", "build:native"], APP_DIR)

    run([NPM, "start"], APP_DIR)

if __name__ == "__main__":
    main()
