import os
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(ROOT, "apps", "electron")

TARGETS = [
    "node_modules",
    ".vite",
    "out",
]

ROOT_TARGETS = [os.path.join(ROOT, "build")]

for target in TARGETS:
    path = os.path.join(APP_DIR, target)

    if os.path.exists(path):
        print(f"Remove : {path}")
        shutil.rmtree(path)

for path in ROOT_TARGETS:
    if os.path.exists(path):
        print(f"Remove : {path}")
        shutil.rmtree(path)

print("Clean Complete.")
