import numpy as np
import pytesseract
from app.parsers.image_preprocessor import ImagePreprocessor

class OCRParser:
    """
    PaddleOCR Engine with Tesseract fallback.
    Extracts text with line-level confidence and handles poor-quality images.
    """

    def __init__(self):
        self.paddle_ocr = None
        self._init_paddle()

    def _init_paddle(self):
        try:
            from paddleocr import PaddleOCR
            # Initialize English PaddleOCR with angle classification enabled
            self.paddle_ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
        except Exception as e:
            # Fallback to Tesseract if PaddleOCR is unavailable
            self.paddle_ocr = None

    def _extract_with_tesseract(self, preprocessed_image: np.ndarray) -> tuple[str, float]:
        """
        Fallback OCR execution using Tesseract
        """
        try:
            text = pytesseract.image_to_string(preprocessed_image, config='--oem 3 --psm 6')
            data = pytesseract.image_to_data(preprocessed_image, output_type=pytesseract.Output.DICT)
            confs = [float(c) for c in data.get('conf', []) if float(c) > 0]
            avg_conf = sum(confs) / len(confs) if confs else 0.8
            return text.strip(), round(avg_conf / 100.0, 4)
        except Exception:
            return "", 0.0

    def extract_text_from_image(self, image_bytes: bytes) -> dict:
        """
        Preprocesses and extracts text from image bytes using PaddleOCR or Tesseract fallback.
        """
        # OpenCV Image Preprocessing (Deskew, Denoise, CLAHE)
        enhanced_img, metrics = ImagePreprocessor.enhance_for_ocr(image_bytes)

        lines = []
        confidences = []
        engine_used = "paddleocr"

        # Try PaddleOCR first
        if self.paddle_ocr is not None:
            try:
                result = self.paddle_ocr.ocr(enhanced_img, cls=True)
                if result and result[0]:
                    for line in result[0]:
                        text = line[1][0]
                        conf = float(line[1][1])
                        lines.append(text)
                        confidences.append(conf)
            except Exception:
                engine_used = "tesseract_fallback"

        # If PaddleOCR returned nothing or failed, execute Tesseract fallback
        if not lines:
            tess_text, tess_conf = self._extract_with_tesseract(enhanced_img)
            if tess_text:
                lines = [tess_text]
                confidences = [tess_conf]
                engine_used = "tesseract"

        combined_text = "\n".join(lines).strip()
        avg_confidence = (
            round(sum(confidences) / len(confidences), 4) if confidences else 0.0
        )

        return {
            "text": combined_text,
            "confidence": avg_confidence,
            "is_ocr": True,
            "engine": engine_used,
            "lines_count": len(lines),
            "image_metrics": metrics,
        }

ocr_parser = OCRParser()

