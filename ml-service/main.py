"""
SecurePay Machine Learning Risk Analysis Service
FastAPI microservice executing versioned anomaly detection model inference,
feature extraction, health checking, and structured explanations.
"""

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
import os
import json
import math
import joblib
import numpy as np
from pydantic import field_validator

app = FastAPI(
    title="SecurePay Risk Analysis Service",
    description="Trained Anomaly Detection and Feature Extraction for Digital Payment Monitoring.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
MODEL_PATH = os.path.join(MODEL_DIR, "isolation_forest_v1.joblib")
REPORT_PATH = os.path.join(MODEL_DIR, "evaluation_report.json")

# Global model state
ML_MODEL = None
MODEL_METADATA = None


def load_model():
    global ML_MODEL, MODEL_METADATA
    if os.path.exists(MODEL_PATH):
        try:
            artifact = joblib.load(MODEL_PATH)
            ML_MODEL = artifact["model"]
            MODEL_METADATA = {
                "version": artifact.get("version", "1.0.0"),
                "features": artifact.get("features", []),
                "score_calibration": artifact.get("score_calibration", {}),
                "trained_at": artifact.get("trained_at"),
            }
        except Exception as e:
            ML_MODEL = None
            MODEL_METADATA = {"error": str(e)}


# Load model at startup
load_model()


class TransactionInput(BaseModel):
    transaction_id: str
    customer_id: str
    amount: float = Field(gt=0, allow_inf_nan=False)
    currency: Literal["INR"] = "INR"
    channel: str = "other"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    merchant_id: Optional[str] = None
    recent_transaction_count: Optional[int] = 0
    avg_customer_amount: Optional[float] = None
    customer_amount_std: Optional[float] = None
    failed_attempts: Optional[int] = 0

    @field_validator("amount", "avg_customer_amount", "customer_amount_std")
    @classmethod
    def validate_rupee_precision(cls, value):
        if value is not None and (not math.isfinite(value) or abs(value * 100 - round(value * 100)) > 1e-7):
            raise ValueError("Monetary values must be finite and have no more than two decimal places.")
        return value


class RiskFeatures(BaseModel):
    transaction_id: str
    amount_normalized: float
    amount_zscore_clamped: float
    is_high_amount: bool
    is_suspicious_channel: bool
    is_unusual_hour: bool
    is_round_amount: bool
    velocity_score: float
    recent_failures_ratio: float
    feature_vector: List[float]


class RiskResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    transaction_id: str
    ml_score: float = Field(ge=0, le=100)
    is_anomaly: bool
    model_version: str
    features: RiskFeatures
    explanation: List[str]
    service_status: str = "operational"


def extract_features(tx: TransactionInput):
    hour = tx.timestamp.hour
    is_unusual_hour = 1 <= hour <= 5
    is_high_amount = tx.amount >= 10000.0
    is_suspicious_channel = tx.channel.lower() in {"crypto"}
    is_round_amount = tx.amount >= 1000.0 and (tx.amount % 1000.0 == 0)
    velocity_score = min(1.0, float(tx.recent_transaction_count or 0) / 10.0)
    recent_failures_ratio = min(1.0, float(tx.failed_attempts or 0) / 5.0)

    amount_zscore = 0.0
    if tx.avg_customer_amount and tx.avg_customer_amount > 0:
        std_val = tx.customer_amount_std if tx.customer_amount_std and tx.customer_amount_std > 0 else (tx.avg_customer_amount * 0.3)
        amount_zscore = (tx.amount - tx.avg_customer_amount) / std_val
    amount_zscore_clamped = float(np.clip(amount_zscore, -3.0, 5.0))
    amount_normalized = float(np.clip(tx.amount / 10000.0, 0.0, 5.0))

    vec = [
        amount_normalized,
        amount_zscore_clamped,
        1.0 if is_high_amount else 0.0,
        1.0 if is_suspicious_channel else 0.0,
        1.0 if is_unusual_hour else 0.0,
        1.0 if is_round_amount else 0.0,
        velocity_score,
        recent_failures_ratio,
    ]

    features = RiskFeatures(
        transaction_id=tx.transaction_id,
        amount_normalized=round(amount_normalized, 4),
        amount_zscore_clamped=round(amount_zscore_clamped, 3),
        is_high_amount=is_high_amount,
        is_suspicious_channel=is_suspicious_channel,
        is_unusual_hour=is_unusual_hour,
        is_round_amount=is_round_amount,
        velocity_score=round(velocity_score, 3),
        recent_failures_ratio=round(recent_failures_ratio, 3),
        feature_vector=[round(v, 4) for v in vec],
    )

    return features, np.array(vec).reshape(1, -1)


@app.get("/")
def root():
    return {
        "service": "SecurePay Risk Analysis Service",
        "version": "1.0.0",
        "ml_model_loaded": ML_MODEL is not None,
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health_check():
    return {
        "status": "operational",
        "service": "SecurePay Risk Analysis Service",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "ml_model_deployed": ML_MODEL is not None,
        "model_metadata": MODEL_METADATA,
    }


@app.get("/metrics")
def get_evaluation_metrics():
    if not os.path.exists(REPORT_PATH):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation metrics report not found. Train model via train.py first.",
        )
    with open(REPORT_PATH, "r") as f:
        return json.load(f)


@app.post("/analyze", response_model=RiskResponse)
def analyze_transaction(tx: TransactionInput):
    """
    Executes feature extraction and runs inference through the trained Isolation Forest model.
    """
    if ML_MODEL is None:
        load_model()
        if ML_MODEL is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Trained ML model artifact is unavailable.",
            )

    try:
        features, feature_matrix = extract_features(tx)

        # Decision score calculation: negative is anomalous
        decision = ML_MODEL.decision_function(feature_matrix)[0]
        prediction = ML_MODEL.predict(feature_matrix)[0]
        is_anomaly = bool(prediction == -1)

        # Normalize score to 0-100 where 100 = most anomalous
        calib = MODEL_METADATA.get("score_calibration", {})
        min_d = calib.get("decision_min", -0.3)
        max_d = calib.get("decision_max", 0.3)
        span = max(max_d - min_d, 0.1)

        ml_score = float(np.clip(((max_d - decision) / span) * 100.0, 0.0, 100.0))

        explanations = []
        if features.is_high_amount:
            explanations.append("Transaction amount exceeds high threshold baseline (INR 10,000+)")
        if features.amount_zscore_clamped >= 2.5:
            explanations.append(f"Amount deviates significantly from customer history (Z-Score: +{features.amount_zscore_clamped})")
        if features.is_suspicious_channel:
            explanations.append("Payment routed through monitored high-risk channel")
        if features.is_unusual_hour:
            explanations.append("Transaction initiated during unusual night hours (01:00-05:00 UTC)")
        if features.velocity_score >= 0.5:
            explanations.append("Elevated transaction frequency in sliding window")
        if features.recent_failures_ratio >= 0.4:
            explanations.append("Multiple recent payment failures or friction observed")

        if not explanations:
            explanations.append("Transaction aligns with normal behavioral and structural patterns")

        return RiskResponse(
            transaction_id=tx.transaction_id,
            ml_score=round(ml_score, 1),
            is_anomaly=is_anomaly,
            model_version=MODEL_METADATA.get("version", "1.0.0"),
            features=features,
            explanation=explanations,
            service_status="operational",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference error: {str(e)}",
        )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
