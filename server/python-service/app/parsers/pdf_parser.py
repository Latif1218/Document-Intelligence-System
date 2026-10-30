import fitz  
from app.parsers.ocr_parser import ocr_parser

class PDFParser:
    """
    High-performance PyMuPDF PDF Parser.
    Extracts digital text layers directly, automatically detects scanned pages,
    renders images at 200 DPI, and routes scanned pages to the OCR engine.
    Handles multi-page documents (supports 1000+ page documents).
    """

    @staticmethod
    def parse_pdf(pdf_bytes: bytes) -> dict:
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        except Exception as e:
            raise ValueError(f"Corrupted or invalid PDF file: {str(e)}")

        page_count = len(doc)
        pages_data = []
        combined_text_list = []

        for page_idx in range(page_count):
            page_num = page_idx + 1
            page = doc[page_idx]

            # Try extracting native digital text layer first
            native_text = page.get_text("text").strip()

            # If digital text exists with sufficient length, use it directly (100% confidence)
            if len(native_text) >= 50:
                pages_data.append({
                    "page_number": page_num,
                    "text": native_text,
                    "confidence": 1.0,
                    "is_ocr": False,
                    "engine": "pymupdf_native",
                })
                combined_text_list.append(native_text)
            else:
                # Scanned page detected  Render page to high-res image and apply OCR
                pix = page.get_pixmap(dpi=200)
                img_bytes = pix.tobytes("png")

                ocr_result = ocr_parser.extract_text_from_image(img_bytes)

                pages_data.append({
                    "page_number": page_num,
                    "text": ocr_result["text"],
                    "confidence": ocr_result["confidence"],
                    "is_ocr": True,
                    "engine": ocr_result["engine"],
                    "image_metrics": ocr_result.get("image_metrics"),
                })
                combined_text_list.append(ocr_result["text"])

        metadata = {
            "title": doc.metadata.get("title", ""),
            "author": doc.metadata.get("author", ""),
            "producer": doc.metadata.get("producer", ""),
            "page_count": page_count,
        }

        doc.close()

        return {
            "file_type": "pdf",
            "page_count": page_count,
            "pages": pages_data,
            "combined_text": "\n\n--- Page Break ---\n\n".join(combined_text_list),
            "metadata": metadata,
        }

pdf_parser = PDFParser()

