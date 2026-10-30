import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.parsers.pdf_parser import pdf_parser
from app.parsers.ocr_parser import ocr_parser
from app.parsers.excel_parser import excel_parser

app = FastAPI(
    title="Document Intelligence Processing Service",
    description="Stateless microservice for PDF parsing, OpenCV deskew, PaddleOCR, and spreadsheet extraction",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    """Healthcheck endpoint for Docker Compose and Node.js client"""
    return {"status": "ok", "service": "python-ocr-parser"}

@app.post("/process")
async def process_document(file: UploadFile = File(...)):
    """
    Accepts PDF, JPG, PNG, TIFF, XLSX, XLS, and CSV files.
    Routes to appropriate parser based on file type and handles corruptions.
    """
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()

    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes).")

        # PDF Documents (Multi-page, Digital + Scanned OCR)
        if ext == ".pdf":
            result = pdf_parser.parse_pdf(file_bytes)
            return {
                "success": True,
                "filename": filename,
                **result,
            }

        # Image Files (OpenCV Deskew, Denoise, PaddleOCR / Tesseract)
        elif ext in [".jpg", ".jpeg", ".png", ".tiff", ".tif"]:
            ocr_result = ocr_parser.extract_text_from_image(file_bytes)
            return {
                "success": True,
                "filename": filename,
                "file_type": "image",
                "page_count": 1,
                "pages": [
                    {
                        "page_number": 1,
                        "text": ocr_result["text"],
                        "confidence": ocr_result["confidence"],
                        "is_ocr": True,
                        "engine": ocr_result["engine"],
                        "image_metrics": ocr_result.get("image_metrics"),
                    }
                ],
                "combined_text": ocr_result["text"],
                "metadata": {"engine": ocr_result["engine"]},
            }

        # Excel Spreadsheets (Multi-sheet handling)
        elif ext in [".xlsx", ".xls"]:
            result = excel_parser.parse_excel(file_bytes)
            return {
                "success": True,
                "filename": filename,
                **result,
            }

        # CSV Files
        elif ext == ".csv":
            result = excel_parser.parse_csv(file_bytes)
            return {
                "success": True,
                "filename": filename,
                **result,
            }

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format: '{ext}'. Allowed: PDF, JPG, PNG, TIFF, XLSX, XLS, CSV.",
            )

    except ValueError as val_err:
        raise HTTPException(status_code=422, detail=str(val_err))
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Internal processing error: {str(err)}")

