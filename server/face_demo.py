import os
import sys
from pathlib import Path

import numpy as np

try:
    import cv2
    import face_recognition
except ImportError as exc:
    missing = getattr(exc, "name", "dependency")
    print(
        f"Missing dependency: {missing}. "
        "Install with: pip install opencv-python face_recognition numpy"
    )
    sys.exit(1)


KNOWN_PEOPLE_DIR = Path(__file__).resolve().parent / "known_people"
HIGH_CONFIDENCE_DISTANCE = 0.45
MEDIUM_CONFIDENCE_DISTANCE = 0.6


def load_known_faces(directory: Path) -> dict[str, np.ndarray]:
    known_embeddings: dict[str, np.ndarray] = {}
    print(f"Enrolling faces from {directory}...")

    for image_path in sorted(directory.iterdir()):
        if image_path.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            continue

        name = image_path.stem
        image = face_recognition.load_image_file(str(image_path))
        encodings = face_recognition.face_encodings(image)

        if encodings:
            known_embeddings[name] = encodings[0]
            print(f"Enrolled: {name}")
        else:
            print(f"Skipped {image_path.name}: no face found")

    return known_embeddings


def resolve_match(
    known_faces: dict[str, np.ndarray], face_encoding: np.ndarray
) -> tuple[str, str, tuple[int, int, int]]:
    if not known_faces:
        return "Unknown", "No enrolled people", (0, 0, 255)

    names = list(known_faces.keys())
    embeddings = list(known_faces.values())
    face_distances = face_recognition.face_distance(embeddings, face_encoding)
    best_match_index = int(np.argmin(face_distances))
    distance = float(face_distances[best_match_index])

    name = "Unknown"
    status = "Low Confidence"
    color = (0, 0, 255)

    if distance < HIGH_CONFIDENCE_DISTANCE:
        name = names[best_match_index]
        status = "MATCH (High Conf)"
        color = (0, 255, 0)
    elif distance < MEDIUM_CONFIDENCE_DISTANCE:
        name = names[best_match_index]
        status = "CONFIRM (Medium Conf)"
        color = (0, 255, 255)

    return name, f"{status} d={distance:.2f}", color


def start_recognition(known_faces: dict[str, np.ndarray]) -> None:
    video_capture = cv2.VideoCapture(0)

    if not video_capture.isOpened():
        print("Could not open the default camera.")
        return

    print("Starting camera. Press 'q' to quit.")

    while True:
        ret, frame = video_capture.read()
        if not ret:
            print("Failed to read from camera.")
            break

        small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
        rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)

        face_locations = face_recognition.face_locations(rgb_small_frame)
        face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)

        for face_encoding, face_location in zip(face_encodings, face_locations):
            name, status, color = resolve_match(known_faces, face_encoding)
            top, right, bottom, left = [value * 4 for value in face_location]
            cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
            cv2.putText(
                frame,
                f"{name}: {status}",
                (left, max(30, top - 10)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                color,
                2,
            )

        cv2.imshow("RememberMe Face Demo", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    video_capture.release()
    cv2.destroyAllWindows()


def main() -> None:
    KNOWN_PEOPLE_DIR.mkdir(exist_ok=True)

    known_faces = load_known_faces(KNOWN_PEOPLE_DIR)
    if not known_faces:
        print(
            "No enrolled faces found. Add .jpg/.jpeg/.png files to "
            f"{KNOWN_PEOPLE_DIR} and run again."
        )
        return

    start_recognition(known_faces)


if __name__ == "__main__":
    main()
