import os
import platform
import subprocess

ROOT = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(ROOT, "app")
IS_WINDOWS = platform.system() == "Windows"
NPM = "npm.cmd" if IS_WINDOWS else "npm"

def run(cmd, cwd):
    print(">", " ".join(cmd))
    subprocess.run(cmd, cwd=cwd, check=True)

def main():
    if not os.path.exists(os.path.join(APP_DIR, "node_modules")):
        run([NPM, "install"], APP_DIR)

    run([NPM, "run", "make"], APP_DIR)

if __name__ == "__main__":
    main()