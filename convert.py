import os

MUSIC_FOLDER = "music"

for folder_name in os.listdir(MUSIC_FOLDER):
    folder_path = os.path.join(MUSIC_FOLDER, folder_name)

    if not os.path.isdir(folder_path):
        continue

    for filename in os.listdir(folder_path):
        file_path = os.path.join(folder_path, filename)

        if not os.path.isfile(file_path):
            continue

        _, ext = os.path.splitext(filename)
        ext = ext.lower()

        if ext == ".jpg":
            new_name = "cover.jpg"
        elif ext == ".mp3":
            new_name = "beat.mp3"
        elif ext == ".png":
            new_name = "cover.png"
        else:
            continue

        new_path = os.path.join(folder_path, new_name)

        # Skip if already correctly named
        if file_path == new_path:
            continue

        # If the destination exists, remove it first
        if os.path.exists(new_path):
            os.remove(new_path)

        os.rename(file_path, new_path)
        print(f"{file_path} -> {new_path}")

print("Done!")