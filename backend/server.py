import os
import json
import sqlite3
from io import BytesIO
from datetime import datetime
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from fastapi import (
    FastAPI,
    File,
    UploadFile,
    HTTPException,
    Header
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from PIL import Image
from google import genai
from google.genai import types


# =========================================================
# FOODLENS — AI FOOD SCANNER BACKEND
# Production-ready foundation
# =========================================================


# =========================================================
# PATHS
# =========================================================

BACKEND_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

PROJECT_DIR = os.path.dirname(
    BACKEND_DIR
)

ENV_PATH = os.path.join(
    BACKEND_DIR,
    ".env"
)

DATABASE_PATH = os.path.join(
    BACKEND_DIR,
    "foodlens.db"
)


# =========================================================
# ENVIRONMENT
# =========================================================

load_dotenv(ENV_PATH)

API_KEY = os.getenv(
    "GEMINI_API_KEY"
)

OWNER_ACTIVATION_CODE = os.getenv(
    "OWNER_ACTIVATION_CODE",
    ""
).strip()

PREMIUM_DAILY_LIMIT = int(
    os.getenv(
        "PREMIUM_DAILY_LIMIT",
        "50"
    )
)

FREE_DAILY_LIMIT = 5

TIMEZONE = ZoneInfo(
    "Asia/Dhaka"
)


# =========================================================
# BASIC VALIDATION
# =========================================================

if not API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is missing. "
        "Please add it to backend/.env"
    )

if not OWNER_ACTIVATION_CODE:
    print(
        "WARNING: OWNER_ACTIVATION_CODE is not configured."
    )

if PREMIUM_DAILY_LIMIT < 1:
    PREMIUM_DAILY_LIMIT = 50


# =========================================================
# GEMINI CLIENT
# =========================================================

client = genai.Client(
    api_key=API_KEY
)


# =========================================================
# FASTAPI
# =========================================================

app = FastAPI(
    title="FoodLens AI Backend",
    version="2.0.0",
    description=(
        "FoodLens AI food recognition "
        "and nutrition analysis backend."
    )
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# DATABASE
# =========================================================

def get_db():

    connection = sqlite3.connect(
        DATABASE_PATH,
        timeout=30
    )

    connection.row_factory = sqlite3.Row

    return connection


def initialize_database():

    connection = get_db()

    try:

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS devices (
                device_id TEXT PRIMARY KEY,
                plan TEXT NOT NULL DEFAULT 'free',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS daily_scans (
                device_id TEXT NOT NULL,
                scan_date TEXT NOT NULL,
                scan_count INTEGER NOT NULL DEFAULT 0,

                PRIMARY KEY (
                    device_id,
                    scan_date
                ),

                FOREIGN KEY (
                    device_id
                )
                REFERENCES devices(device_id)
                ON DELETE CASCADE
            )
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_daily_scans_device_date
            ON daily_scans (
                device_id,
                scan_date
            )
            """
        )

        connection.commit()

    finally:

        connection.close()


initialize_database()


# =========================================================
# TIME HELPERS
# =========================================================

def now_local():

    return datetime.now(
        TIMEZONE
    )


def today_string():

    return now_local().date().isoformat()


def timestamp_string():

    return now_local().isoformat()


# =========================================================
# DEVICE VALIDATION
# =========================================================

def clean_device_id(
    device_id: str | None
):

    if not device_id:
        return None

    device_id = device_id.strip()

    if not device_id:
        return None

    if len(device_id) > 128:
        return None

    return device_id


def require_device_id(
    device_id: str | None
):

    cleaned = clean_device_id(
        device_id
    )

    if not cleaned:

        raise HTTPException(
            status_code=400,
            detail={
                "code": "DEVICE_ID_REQUIRED",
                "message": (
                    "FoodLens device ID is required."
                )
            }
        )

    return cleaned


# =========================================================
# DEVICE MANAGEMENT
# =========================================================

def ensure_device(
    device_id: str
):

    connection = get_db()

    try:

        existing = connection.execute(
            """
            SELECT *
            FROM devices
            WHERE device_id = ?
            """,
            (
                device_id,
            )
        ).fetchone()

        if existing:

            return dict(
                existing
            )

        current_time = timestamp_string()

        connection.execute(
            """
            INSERT INTO devices (
                device_id,
                plan,
                created_at,
                updated_at
            )
            VALUES (
                ?,
                'free',
                ?,
                ?
            )
            """,
            (
                device_id,
                current_time,
                current_time
            )
        )

        connection.commit()

        return {
            "device_id": device_id,
            "plan": "free",
            "created_at": current_time,
            "updated_at": current_time
        }

    finally:

        connection.close()


def get_device(
    device_id: str
):

    connection = get_db()

    try:

        row = connection.execute(
            """
            SELECT *
            FROM devices
            WHERE device_id = ?
            """,
            (
                device_id,
            )
        ).fetchone()

        if not row:
            return None

        return dict(
            row
        )

    finally:

        connection.close()


def set_device_plan(
    device_id: str,
    plan: str
):

    allowed_plans = {
        "free",
        "premium",
        "owner"
    }

    if plan not in allowed_plans:

        raise ValueError(
            "Invalid plan."
        )

    ensure_device(
        device_id
    )

    connection = get_db()

    try:

        connection.execute(
            """
            UPDATE devices

            SET
                plan = ?,
                updated_at = ?

            WHERE device_id = ?
            """,
            (
                plan,
                timestamp_string(),
                device_id
            )
        )

        connection.commit()

    finally:

        connection.close()


# =========================================================
# DAILY SCAN DATABASE
# =========================================================

def get_today_scan_count(
    device_id: str
):

    scan_date = today_string()

    connection = get_db()

    try:

        row = connection.execute(
            """
            SELECT scan_count
            FROM daily_scans
            WHERE device_id = ?
              AND scan_date = ?
            """,
            (
                device_id,
                scan_date
            )
        ).fetchone()

        if not row:
            return 0

        return int(
            row["scan_count"]
        )

    finally:

        connection.close()


def increment_scan_count(
    device_id: str
):

    scan_date = today_string()

    connection = get_db()

    try:

        connection.execute(
            """
            INSERT INTO daily_scans (
                device_id,
                scan_date,
                scan_count
            )

            VALUES (
                ?,
                ?,
                1
            )

            ON CONFLICT (
                device_id,
                scan_date
            )

            DO UPDATE SET
                scan_count =
                    scan_count + 1
            """,
            (
                device_id,
                scan_date
            )
        )

        connection.commit()

    finally:

        connection.close()


# =========================================================
# PLAN INFORMATION
# =========================================================

def get_plan_limit(
    plan: str
):

    if plan == "owner":

        return {
            "limit": None,
            "unlimited": True
        }

    if plan == "premium":

        return {
            "limit": PREMIUM_DAILY_LIMIT,
            "unlimited": False
        }

    return {
        "limit": FREE_DAILY_LIMIT,
        "unlimited": False
    }


def build_scan_status(
    device_id: str
):

    device = ensure_device(
        device_id
    )

    plan = device["plan"]

    used = get_today_scan_count(
        device_id
    )

    plan_info = get_plan_limit(
        plan
    )

    unlimited = plan_info[
        "unlimited"
    ]

    limit = plan_info[
        "limit"
    ]

    if unlimited:

        remaining = None
        can_scan = True

    else:

        remaining = max(
            limit - used,
            0
        )

        can_scan = (
            remaining > 0
        )

    return {
        "device_id": device_id,
        "plan": plan,
        "used": used,
        "limit": limit,
        "remaining": remaining,
        "can_scan": can_scan,
        "unlimited": unlimited,
        "date": today_string()
    }


# =========================================================
# LIMIT CHECK
# =========================================================

def check_scan_allowed(
    device_id: str
):

    status = build_scan_status(
        device_id
    )

    if status["unlimited"]:
        return status

    if not status["can_scan"]:

        raise HTTPException(
            status_code=429,
            detail={
                "code":
                    "DAILY_LIMIT_REACHED",

                "message":
                    (
                        "You have reached "
                        "today's AI scan limit."
                    ),

                "plan":
                    status["plan"],

                "limit":
                    status["limit"],

                "used":
                    status["used"],

                "remaining":
                    0
            }
        )

    return status


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get(
    "/",
    include_in_schema=False
)
def serve_frontend():

    if not os.path.exists(
        INDEX_FILE
    ):

        return {
            "app":
                "FoodLens AI Backend",

            "status":
                "online"
        }

    return FileResponse(
        INDEX_FILE,
        media_type="text/html"
    )


# =========================================================
# API HEALTH
# =========================================================

@app.get("/health")
def health():

    return {
        "status":
            "healthy",

        "service":
            "FoodLens",

        "time":
            timestamp_string()
    }


# =========================================================
# SCAN STATUS
# =========================================================

@app.get("/scan-status")
def scan_status(
    x_device_id: str | None = Header(
        default=None,
        alias="X-Device-ID"
    )
):

    device_id = require_device_id(
        x_device_id
    )

    return build_scan_status(
        device_id
    )


# =========================================================
# AI FOOD PROMPT
# =========================================================

FOOD_ANALYSIS_PROMPT = """
You are the nutrition analysis engine for an app called FoodLens.

Analyze the food shown in the image.

IMPORTANT RULES:

1. Identify the visible food as accurately as possible.

2. If multiple foods are visible,
   identify each major food separately.

3. Estimate the portion size from the image.

4. Estimate:
   - calories
   - protein
   - carbohydrates
   - fat
   - fiber

5. These are estimates.
   They are NOT laboratory measurements.

6. Do not invent impossible precision.

7. Use realistic nutritional estimates.

8. If the image is unclear,
   say that the estimate has lower confidence.

9. If the image does not contain food,
   clearly say that.

10. Do not diagnose diseases.

11. Do not claim medical certainty.

12. Keep numeric values as whole numbers
    where practical.

13. Confidence should be a number
    between 0 and 1.

14. Return ONLY valid JSON.

Use exactly this structure:

{
  "success": true,
  "meal_name": "string",
  "confidence": 0.0,

  "items": [
    {
      "name": "string",
      "portion": "string",
      "calories": 0,
      "protein_g": 0,
      "carbs_g": 0,
      "fat_g": 0,
      "fiber_g": 0
    }
  ],

  "total": {
    "calories": 0,
    "protein_g": 0,
    "carbs_g": 0,
    "fat_g": 0,
    "fiber_g": 0
  },

  "notes": "string"
}
"""


# =========================================================
# IMAGE PROCESSING
# =========================================================

async def process_uploaded_image(
    file: UploadFile
):

    if not file.content_type:

        raise HTTPException(
            status_code=400,
            detail="Invalid image file."
        )

    if not file.content_type.startswith(
        "image/"
    ):

        raise HTTPException(
            status_code=400,
            detail="Please upload an image."
        )

    image_bytes = await file.read()

    if not image_bytes:

        raise HTTPException(
            status_code=400,
            detail="The uploaded image is empty."
        )

    if len(image_bytes) > (
        10 * 1024 * 1024
    ):

        raise HTTPException(
            status_code=413,
            detail=(
                "Image is too large. "
                "Maximum size is 10 MB."
            )
        )

    try:

        original_image = Image.open(
            BytesIO(image_bytes)
        )

        original_image.verify()

    except Exception:

        raise HTTPException(
            status_code=400,
            detail=(
                "The uploaded file "
                "is not a valid image."
            )
        )

    try:

        image = Image.open(
            BytesIO(image_bytes)
        ).convert("RGB")

        image.thumbnail(
            (
                1600,
                1600
            )
        )

        buffer = BytesIO()

        image.save(
            buffer,
            format="JPEG",
            quality=85,
            optimize=True
        )

        return buffer.getvalue()

    except Exception as error:

        print(
            "Image processing error:",
            error
        )

        raise HTTPException(
            status_code=400,
            detail=(
                "The image could not "
                "be processed."
            )
        )


# =========================================================
# AI RESPONSE VALIDATION
# =========================================================

def clean_number(
    value
):

    try:

        number = float(
            value
        )

        if number < 0:
            return 0

        return int(
            round(number)
        )

    except (
        TypeError,
        ValueError
    ):

        return 0


def clean_confidence(
    value
):

    try:

        confidence = float(
            value
        )

    except (
        TypeError,
        ValueError
    ):

        return 0

    confidence = max(
        0,
        min(
            confidence,
            1
        )
    )

    return confidence


def normalize_ai_result(
    result
):

    if not isinstance(
        result,
        dict
    ):

        raise ValueError(
            "AI response is not an object."
        )

    result["success"] = bool(
        result.get(
            "success",
            True
        )
    )

    result["meal_name"] = str(
        result.get(
            "meal_name",
            "Food Analysis"
        )
    ).strip() or "Food Analysis"

    result["confidence"] = clean_confidence(
        result.get(
            "confidence",
            0
        )
    )

    items = result.get(
        "items",
        []
    )

    if not isinstance(
        items,
        list
    ):

        items = []

    clean_items = []

    for item in items:

        if not isinstance(
            item,
            dict
        ):

            continue

        clean_items.append(
            {
                "name":
                    str(
                        item.get(
                            "name",
                            "Food item"
                        )
                    ),

                "portion":
                    str(
                        item.get(
                            "portion",
                            "Estimated portion"
                        )
                    ),

                "calories":
                    clean_number(
                        item.get(
                            "calories",
                            0
                        )
                    ),

                "protein_g":
                    clean_number(
                        item.get(
                            "protein_g",
                            0
                        )
                    ),

                "carbs_g":
                    clean_number(
                        item.get(
                            "carbs_g",
                            0
                        )
                    ),

                "fat_g":
                    clean_number(
                        item.get(
                            "fat_g",
                            0
                        )
                    ),

                "fiber_g":
                    clean_number(
                        item.get(
                            "fiber_g",
                            0
                        )
                    )
            }
        )

    result["items"] = clean_items

    total = result.get(
        "total",
        {}
    )

    if not isinstance(
        total,
        dict
    ):

        total = {}

    result["total"] = {
        "calories":
            clean_number(
                total.get(
                    "calories",
                    0
                )
            ),

        "protein_g":
            clean_number(
                total.get(
                    "protein_g",
                    0
                )
            ),

        "carbs_g":
            clean_number(
                total.get(
                    "carbs_g",
                    0
                )
            ),

        "fat_g":
            clean_number(
                total.get(
                    "fat_g",
                    0
                )
            ),

        "fiber_g":
            clean_number(
                total.get(
                    "fiber_g",
                    0
                )
            )
    }

    result["notes"] = str(
        result.get(
            "notes",
            ""
        )
    )

    return result


# =========================================================
# AI FOOD ANALYSIS
# =========================================================

@app.post("/analyze-food")
async def analyze_food(
    file: UploadFile = File(...),

    x_device_id: str | None = Header(
        default=None,
        alias="X-Device-ID"
    )
):

    device_id = require_device_id(
        x_device_id
    )

    scan_status = check_scan_allowed(
        device_id
    )

    processed_image = (
        await process_uploaded_image(
            file
        )
    )

    try:

        response = (
            client.models.generate_content(

                model=
                    "gemini-3.5-flash-lite",

                contents=[
                    types.Part.from_bytes(
                        data=
                            processed_image,

                        mime_type=
                            "image/jpeg"
                    ),

                    FOOD_ANALYSIS_PROMPT
                ],

                config=
                    types.GenerateContentConfig(

                        response_mime_type=
                            "application/json",

                        temperature=
                            0.2
                    )
            )
        )

        result_text = (
            response.text or ""
        ).strip()

    except Exception as error:

        print(
            "Gemini API Error:",
            repr(error)
        )

        raise HTTPException(
            status_code=502,
            detail={
                "code":
                    "AI_REQUEST_FAILED",

                "message":
                    (
                        "FoodLens AI "
                        "analysis failed. "
                        "Please try again."
                    )
            }
        )

    if not result_text:

        raise HTTPException(
            status_code=502,
            detail={
                "code":
                    "EMPTY_AI_RESPONSE",

                "message":
                    (
                        "AI returned an "
                        "empty response."
                    )
            }
        )

    try:

        result = json.loads(
            result_text
        )

    except json.JSONDecodeError:

        print(
            "Invalid Gemini JSON:"
        )

        print(
            result_text
        )

        raise HTTPException(
            status_code=502,
            detail={
                "code":
                    "INVALID_AI_JSON",

                "message":
                    (
                        "AI returned an "
                        "invalid response."
                    )
            }
        )

    try:

        result = normalize_ai_result(
            result
        )

    except Exception as error:

        print(
            "AI result validation error:",
            error
        )

        raise HTTPException(
            status_code=502,
            detail={
                "code":
                    "INVALID_AI_RESULT",

                "message":
                    (
                        "AI result could "
                        "not be processed."
                    )
            }
        )

    increment_scan_count(
        device_id
    )

    updated_status = build_scan_status(
        device_id
    )

    result["scan"] = {
        "device_id":
            device_id,

        "plan":
            updated_status["plan"],

        "used":
            updated_status["used"],

        "limit":
            updated_status["limit"],

        "remaining":
            updated_status["remaining"],

        "unlimited":
            updated_status["unlimited"],

        "timestamp":
            timestamp_string()
    }

    return result


# =========================================================
# OWNER ACTIVATION
# =========================================================

class OwnerActivationRequest(
    BaseModel
):

    activation_code: str


@app.post("/owner/activate")
def owner_activate(
    request: OwnerActivationRequest,

    x_device_id: str | None = Header(
        default=None,
        alias="X-Device-ID"
    )
):

    # -----------------------------------------------------
    # Device
    # -----------------------------------------------------

    device_id = require_device_id(
        x_device_id
    )

    # -----------------------------------------------------
    # Check owner code configuration
    # -----------------------------------------------------

    if not OWNER_ACTIVATION_CODE:

        raise HTTPException(
            status_code=503,
            detail={
                "code":
                    "OWNER_CODE_NOT_CONFIGURED",

                "message":
                    (
                        "Owner activation "
                        "is not configured."
                    )
            }
        )

    # -----------------------------------------------------
    # Get activation code from JSON body
    # -----------------------------------------------------

    activation_code = (
        request.activation_code or ""
    ).strip()

    # -----------------------------------------------------
    # Empty code
    # -----------------------------------------------------

    if not activation_code:

        raise HTTPException(
            status_code=400,
            detail={
                "code":
                    "ACTIVATION_CODE_REQUIRED",

                "message":
                    "Activation code is required."
            }
        )

    # -----------------------------------------------------
    # Validate activation code
    # -----------------------------------------------------

    if activation_code != (
        OWNER_ACTIVATION_CODE
    ):

        raise HTTPException(
            status_code=403,
            detail={
                "code":
                    "INVALID_ACTIVATION_CODE",

                "message":
                    "Invalid activation code."
            }
        )

    # -----------------------------------------------------
    # Activate Owner plan
    # -----------------------------------------------------

    set_device_plan(
        device_id,
        "owner"
    )

    # -----------------------------------------------------
    # Return updated status
    # -----------------------------------------------------

    return {
        "success":
            True,

        "message":
            "Owner access activated.",

        "status":
            build_scan_status(
                device_id
            )
    }


# =========================================================
# OWNER — SET USER PLAN
# =========================================================

@app.post("/owner/set-plan")
def owner_set_plan(
    target_device_id: str,
    plan: str,
    activation_code: str
):

    if not OWNER_ACTIVATION_CODE:

        raise HTTPException(
            status_code=503,
            detail={
                "code":
                    "OWNER_CODE_NOT_CONFIGURED",

                "message":
                    (
                        "Owner activation "
                        "is not configured."
                    )
            }
        )

    if activation_code.strip() != (
        OWNER_ACTIVATION_CODE
    ):

        raise HTTPException(
            status_code=403,
            detail={
                "code":
                    "INVALID_ACTIVATION_CODE",

                "message":
                    "Invalid activation code."
            }
        )

    target_device_id = (
        clean_device_id(
            target_device_id
        )
    )

    if not target_device_id:

        raise HTTPException(
            status_code=400,
            detail={
                "code":
                    "DEVICE_ID_REQUIRED",

                "message":
                    "Target device ID is required."
            }
        )

    plan = plan.strip().lower()

    if plan not in {
        "free",
        "premium",
        "owner"
    }:

        raise HTTPException(
            status_code=400,
            detail={
                "code":
                    "INVALID_PLAN",

                "message":
                    (
                        "Plan must be "
                        "free, premium or owner."
                    )
            }
        )

    set_device_plan(
        target_device_id,
        plan
    )

    return {
        "success":
            True,

        "message":
            (
                f"Device plan changed "
                f"to {plan}."
            ),

        "status":
            build_scan_status(
                target_device_id
            )
    }


# =========================================================
# SERVE FRONTEND
# =========================================================

INDEX_FILE = os.path.join(
    PROJECT_DIR,
    "index.html"
)

STYLE_FILE = os.path.join(
    PROJECT_DIR,
    "style.css"
)

SCRIPT_FILE = os.path.join(
    PROJECT_DIR,
    "script.js"
)


@app.get(
    "/style.css",
    include_in_schema=False
)
def serve_style():

    if not os.path.exists(
        STYLE_FILE
    ):

        raise HTTPException(
            status_code=404,
            detail="style.css not found."
        )

    return FileResponse(
        STYLE_FILE,
        media_type="text/css"
    )


@app.get(
    "/script.js",
    include_in_schema=False
)
def serve_script():

    if not os.path.exists(
        SCRIPT_FILE
    ):

        raise HTTPException(
            status_code=404,
            detail="script.js not found."
        )

    return FileResponse(
        SCRIPT_FILE,
        media_type="application/javascript"
    )


@app.get(
    "/app",
    include_in_schema=False
)
def serve_app():

    if not os.path.exists(
        INDEX_FILE
    ):

        raise HTTPException(
            status_code=404,
            detail="index.html not found."
        )

    return FileResponse(
        INDEX_FILE,
        media_type="text/html"
    )