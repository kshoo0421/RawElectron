import os
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(ROOT, "app")

TARGETS = [
    "node_modules",
    ".vite",
    "out",
]

for target in TARGETS:
    path = os.path.join(APP_DIR, target)

    if os.path.exists(path):
        print(f"Remove : {path}")
        shutil.rmtree(path)

print("Clean Complete.")