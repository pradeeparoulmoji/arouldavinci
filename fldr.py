import os
import json

# Folder containing the JSON file
MUSIC_FOLDER = "music"
JSON_FILE = os.path.join(MUSIC_FOLDER, "beats.json")  # Change filename if needed

with open(JSON_FILE, "r", encoding="utf-8") as f:
    beats = json.load(f)

created = 0
skipped = 0

for beat in beats:
    folder_name = beat.get("folder")
    if not folder_name:
        continue

    folder_path = os.path.join(MUSIC_FOLDER, folder_name)

    if not os.path.isdir(folder_path):
        os.makedirs(folder_path)
        print(f"Created: {folder_path}")
        created += 1
    else:
        print(f"Exists:  {folder_path}")
        skipped += 1

print(f"\nDone!")
print(f"Created: {created}")
print(f"Skipped: {skipped}")