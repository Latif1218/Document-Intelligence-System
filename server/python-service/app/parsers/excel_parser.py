import io
import pandas as pd

class ExcelParser:
    """
    Parses spreadsheets (.xlsx, .xls) and .csv files.
    Extracts all sheets, formats them as structured markdown tables for LLM consumption,
    and detects corrupted spreadsheets.
    """

    @staticmethod
    def parse_csv(csv_bytes: bytes) -> dict:
        try:
            # Try utf-8 first, fallback to latin-1 for legacy CSV files
            try:
                df = pd.read_csv(io.BytesIO(csv_bytes), encoding='utf-8')
            except UnicodeDecodeError:
                df = pd.read_csv(io.BytesIO(csv_bytes), encoding='latin-1')

            # Clean NaN values
            df = df.fillna('')
            table_markdown = df.to_markdown(index=False)

            return {
                "file_type": "csv",
                "page_count": 1,
                "pages": [
                    {
                        "page_number": 1,
                        "text": table_markdown,
                        "confidence": 1.0,
                        "is_ocr": False,
                        "engine": "pandas_csv",
                    }
                ],
                "combined_text": table_markdown,
                "metadata": {
                    "rows": len(df),
                    "columns": list(df.columns),
                },
            }
        except Exception as e:
            raise ValueError(f"Corrupted or invalid CSV file: {str(e)}")

    @staticmethod
    def parse_excel(excel_bytes: bytes) -> dict:
        try:
            excel_file = pd.ExcelFile(io.BytesIO(excel_bytes))
            sheet_names = excel_file.sheet_names

            pages_data = []
            combined_texts = []

            for idx, sheet_name in enumerate(sheet_names):
                df = pd.read_excel(excel_file, sheet_name=sheet_name)
                df = df.fillna('')

                # Convert dataframe to markdown representation
                sheet_md = f"### Sheet: {sheet_name}\n" + df.to_markdown(index=False)

                pages_data.append({
                    "page_number": idx + 1,
                    "text": sheet_md,
                    "confidence": 1.0,
                    "is_ocr": False,
                    "engine": "openpyxl_excel",
                    "sheet_name": sheet_name,
                })
                combined_texts.append(sheet_md)

            return {
                "file_type": "excel",
                "page_count": len(sheet_names),
                "pages": pages_data,
                "combined_text": "\n\n--- Sheet Break ---\n\n".join(combined_texts),
                "metadata": {
                    "sheet_names": sheet_names,
                    "total_sheets": len(sheet_names),
                },
            }
        except Exception as e:
            raise ValueError(f"Corrupted or invalid Excel spreadsheet: {str(e)}")

excel_parser = ExcelParser()

