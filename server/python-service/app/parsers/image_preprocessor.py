import cv2
import numpy as np

class ImagePreprocessor:
    """
    OpenCV Preprocessor to optimize scanned images and degraded receipts/invoices.
    Handles deskewing, noise reduction, contrast enhancement, and blur assessment.
    """

    @staticmethod
    def assess_blur(gray_image: np.ndarray) -> float:
        """
        Compute Laplacian variance to detect if image is blurry.
        Values below 100 typically indicate poor quality / blurriness.
        """
        return float(cv2.Laplacian(gray_image, cv2.CV_64F).var())

    @staticmethod
    def deskew(image: np.ndarray) -> np.ndarray:
        """
        Detect skew angle using minAreaRect on foreground pixels and rotate image straight.
        """
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
            # Invert colors so text is white
            thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]

            # Find coordinates of all text pixels
            coords = np.column_stack(np.where(thresh > 0))
            if len(coords) == 0:
                return image

            angle = cv2.minAreaRect(coords)[-1]

            # Normalize angle
            if angle < -45:
                angle = -(90 + angle)
            elif angle > 45:
                angle = 90 - angle

            # If slight angle detected, rotate
            if abs(angle) > 0.5:
                (h, w) = image.shape[:2]
                center = (w // 2, h // 2)
                M = cv2.getRotationMatrix2D(center, angle, 1.0)
                rotated = cv2.warpAffine(
                    image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
                )
                return rotated
        except Exception:
            pass
        return image

    @classmethod
    def enhance_for_ocr(cls, image_bytes: bytes) -> tuple[np.ndarray, dict]:
        """
        Full enhancement pipeline for OCR:
        1. Decode image bytes
        2. Blur/Quality analysis
        3. Deskew
        4. Denoise and CLAHE (Adaptive Histogram Equalization)
        """
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Failed to decode image bytes. File might be corrupted.")

        # Deskew
        straight_img = cls.deskew(img)

        # Convert to Grayscale
        gray = cv2.cvtColor(straight_img, cv2.COLOR_BGR2GRAY)

        # Assess Blur Quality
        blur_score = cls.assess_blur(gray)
        is_blurry = blur_score < 100.0

        # Enhance Contrast using CLAHE
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced_gray = clahe.apply(gray)

        # Denoise (Bilateral Filter preserves edges while removing noise)
        denoised = cv2.bilateralFilter(enhanced_gray, 9, 75, 75)

        metrics = {
            "blur_score": round(blur_score, 2),
            "is_blurry": is_blurry,
            "width": int(img.shape[1]),
            "height": int(img.shape[0]),
        }

        return denoised, metrics

