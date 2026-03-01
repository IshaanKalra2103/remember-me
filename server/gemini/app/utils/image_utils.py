import base64
import io
import numpy as np
from PIL import Image


def base64_to_pil(b64_string: str) -> Image.Image:
    """Decode a base64 image string to a PIL Image.
    Strips data URI prefix if present (e.g. 'data:image/jpeg;base64,...').
    """
    if "," in b64_string:
        b64_string = b64_string.split(",", 1)[1]
    image_bytes = base64.b64decode(b64_string)
    return Image.open(io.BytesIO(image_bytes))


def base64_to_numpy_rgb(b64_string: str) -> np.ndarray:
    """Decode a base64 image to an RGB numpy array.
    Required format for the face_recognition library.
    """
    pil_image = base64_to_pil(b64_string)
    return np.array(pil_image.convert("RGB"))


def pil_to_bytes(image: Image.Image, format: str = "JPEG") -> bytes:
    """Serialize a PIL Image to raw bytes (for Gemini multimodal if needed)."""
    buffer = io.BytesIO()
    image.save(buffer, format=format)
    return buffer.getvalue()
