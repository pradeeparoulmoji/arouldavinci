import os
import json
import shutil
import re
import argparse
from difflib import SequenceMatcher


MUSIC_FOLDER = "music"
DONE_FOLDER = "done"
JSON_FILE = os.path.join(MUSIC_FOLDER, "beats.json")


# ----------------------------
# Helpers
# ----------------------------

def normalize(text):
    text = text.lower()

    # remove dates like 02.03.25
    text = re.sub(r"\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b", " ", text)

    # remove punctuation
    text = re.sub(r"[^a-z0-9 ]", " ", text)

    return " ".join(text.split())


def words(text):
    return set(normalize(text).split())


def similarity(a, b):
    return SequenceMatcher(None, a, b).ratio()


# ----------------------------
# Matching engine
# ----------------------------

def score_folder(folder_name, beat):

    folder_text = normalize(folder_name)
    folder_words = words(folder_name)

    score = 0

    title = normalize(beat.get("title", ""))
    beat_folder = normalize(beat.get("folder", ""))

    tags = [
        normalize(x)
        for x in beat.get("tag", [])
    ]

    bpm = str(beat.get("bpm", "")).strip()


    # Exact title similarity
    score += similarity(folder_text, title) * 50

    # Folder name similarity
    score += similarity(folder_text, beat_folder) * 30


    # Word matches
    for word in folder_words:

        if len(word) < 3:
            continue

        if word in title:
            score += 50

        if word in beat_folder:
            score += 30

        for tag in tags:
            if word in tag:
                score += 80


    # BPM match
    if bpm and bpm in folder_text:
        score += 20


    return score



def find_match(folder_name, beats):

    results = []

    for beat in beats:
        s = score_folder(folder_name, beat)
        results.append(
            (s, beat)
        )

    results.sort(
        key=lambda x: x[0],
        reverse=True
    )

    return results



# ----------------------------
# File importing
# ----------------------------

def import_files(source, destination):

    os.makedirs(destination, exist_ok=True)

    for file in os.listdir(source):

        old = os.path.join(source, file)

        if not os.path.isfile(old):
            continue


        ext = os.path.splitext(file)[1].lower()

        if ext == ".jpg":
            new_name = "cover.jpg"

        elif ext == ".mp3":
            new_name = "beat.mp3"

        elif ext == ".wav":
            new_name = "beat.wav"

        else:
            new_name = file


        new_path = os.path.join(
            destination,
            new_name
        )


        if os.path.exists(new_path):
            print(
                f"   ! Exists, skipping {new_name}"
            )
            continue


        shutil.copy2(
            old,
            new_path
        )

        print(
            f"   + {new_name}"
        )



# ----------------------------
# Main
# ----------------------------

parser = argparse.ArgumentParser()

parser.add_argument(
    "--dry-run",
    action="store_true",
    help="Only show matches"
)

args = parser.parse_args()



with open(JSON_FILE, encoding="utf-8") as f:
    beats = json.load(f)



used = set()


for folder in os.listdir(DONE_FOLDER):

    source = os.path.join(
        DONE_FOLDER,
        folder
    )

    if not os.path.isdir(source):
        continue


    matches = find_match(
        folder,
        beats
    )


    best_score, best = matches[0]

    second_score = matches[1][0]


    print("\n-------------------------")
    print(folder)

    print(
        f"BEST: {best['folder']} "
        f"({best_score:.1f})"
    )


    # safety checks

    if best_score < 80:
        print(
            "SKIPPED: low confidence"
        )
        continue


    if best_score - second_score < 25:
        print(
            "SKIPPED: ambiguous match"
        )
        print(
            f"Second: {matches[1][1]['folder']} "
            f"({second_score:.1f})"
        )
        continue


    if best["folder"] in used:
        print(
            "SKIPPED: already matched"
        )
        continue


    used.add(
        best["folder"]
    )


    destination = os.path.join(
        MUSIC_FOLDER,
        best["folder"]
    )


    if args.dry_run:
        print(
            "DRY RUN - no files copied"
        )
    else:
        print(
            "IMPORTING..."
        )

        import_files(
            source,
            destination
        )


print("\nFinished.")