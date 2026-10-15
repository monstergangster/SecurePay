"""
SecurePay Anomaly Detection Model Training & Evaluation Pipeline
Trains an unsupervised Isolation Forest on synthetic digital payment transactions,
evaluates on a strictly separated labeled holdout set, and saves the versioned model artifact.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    roc_auc_score,
    average_precision_score,
)

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)
MODEL_PATH = os.path.join(MODEL_DIR, "isolation_forest_v1.joblib")
METRICS_PATH = os.path.join(MODEL_DIR, "evaluation_report.json")

FEATURE_NAMES = [
    "amount_normalized",        # INR amount / 10000.0
    "amount_zscore_clamped",    # clamped z-score [-3, +3]
    "is_high_amount",           # 1 if amount >= INR 10,000 else 0
    "is_suspicious_channel",    # 1 if crypto else 0
    "is_unusual_hour",          # 1 if 01:00-05:00 UTC else 0
    "is_round_amount",          # 1 if amount >= 1000 and % 1000 == 0
    "velocity_score",           # recent transactions / 10.0 clamped
    "recent_failures_ratio",    # failed attempts / 5.0 clamped
]


def generate_synthetic_dataset(n_samples=5000, fraud_ratio=0.04, random_state=42):
    """
    Generates a realistic, deterministic synthetic payment dataset with standard
    and anomalous transaction clusters.
    """
    np.random.seed(random_state)
    n_fraud = int(n_samples * fraud_ratio)
    n_legit = n_samples - n_fraud

    # Synthetic amounts use rupees: most legitimate payments are below INR 10,000.
    amounts_legit = np.random.exponential(scale=85, size=n_legit) + 5
    zscores_legit = np.random.normal(loc=0.0, scale=0.8, size=n_legit)
    channels_legit = np.random.choice([0, 1], p=[0.98, 0.02], size=n_legit)
    hours_legit = np.random.choice([0, 1], p=[0.95, 0.05], size=n_legit)
    round_legit = np.random.choice([0, 1], p=[0.97, 0.03], size=n_legit)
    velocity_legit = np.random.beta(a=1, b=8, size=n_legit)
    failures_legit = np.random.choice([0, 0.2, 0.4], p=[0.92, 0.06, 0.02], size=n_legit)
    labels_legit = np.zeros(n_legit, dtype=int)

    # Fraudulent distribution
    amounts_fraud = np.random.uniform(3000, 15000, size=n_fraud)
    zscores_fraud = np.random.normal(loc=3.2, scale=1.2, size=n_fraud)
    channels_fraud = np.random.choice([0, 1], p=[0.55, 0.45], size=n_fraud)
    hours_fraud = np.random.choice([0, 1], p=[0.60, 0.40], size=n_fraud)
    round_fraud = np.random.choice([0, 1], p=[0.70, 0.30], size=n_fraud)
    velocity_fraud = np.random.beta(a=4, b=2, size=n_fraud)
    failures_fraud = np.random.choice([0.2, 0.4, 0.8, 1.0], p=[0.2, 0.3, 0.3, 0.2], size=n_fraud)
    labels_fraud = np.ones(n_fraud, dtype=int)

    X_amounts = np.concatenate([amounts_legit, amounts_fraud])
    X_zscores = np.concatenate([zscores_legit, zscores_fraud])
    X_channels = np.concatenate([channels_legit, channels_fraud])
    X_hours = np.concatenate([hours_legit, hours_fraud])
    X_round = np.concatenate([round_legit, round_fraud])
    X_velocity = np.concatenate([velocity_legit, velocity_fraud])
    X_failures = np.concatenate([failures_legit, failures_fraud])
    y = np.concatenate([labels_legit, labels_fraud])

    # Feature transformations
    amount_norm = np.clip(X_amounts / 10000.0, 0.0, 5.0)
    amount_z_clamped = np.clip(X_zscores, -3.0, 5.0)
    is_high = (X_amounts >= 10000.0).astype(float)

    X = np.column_stack([
        amount_norm,
        amount_z_clamped,
        is_high,
        X_channels,
        X_hours,
        X_round,
        np.clip(X_velocity, 0.0, 1.0),
        np.clip(X_failures, 0.0, 1.0),
    ])

    indices = np.arange(len(y))
    np.random.shuffle(indices)
    return X[indices], y[indices]


def train_and_evaluate():
    print("Generating synthetic payment training and holdout datasets...")
    X, y = generate_synthetic_dataset(n_samples=6000, fraud_ratio=0.045, random_state=42)

    # 75% Train (unsupervised), 25% Holdout test (labeled evaluation)
    split_idx = int(0.75 * len(y))
    X_train, y_train = X[:split_idx], y[:split_idx]
    X_test, y_test = X[split_idx:], y[split_idx:]

    print(f"Training set: {len(X_train)} transactions")
    print(f"Holdout evaluation set: {len(X_test)} transactions (True Positives: {int(sum(y_test))})")

    # Train Isolation Forest on training data ONLY
    contamination = 0.045
    model = IsolationForest(
        n_estimators=100,
        contamination=contamination,
        max_samples="auto",
        random_state=42,
        n_jobs=-1,
    )

    print("Fitting Isolation Forest model...")
    model.fit(X_train)

    # Invert anomaly score: higher score = more anomalous (0 to 1 scale)
    raw_decision = model.decision_function(X_test)
    # Decision function: negative values are anomalies. Normalize to [0, 100]
    min_d, max_d = np.min(raw_decision), np.max(raw_decision)
    anomaly_scores_100 = ((max_d - raw_decision) / (max_d - min_d + 1e-8)) * 100.0

    # Binary prediction: -1 = anomaly, 1 = normal
    raw_preds = model.predict(X_test)
    y_pred = (raw_preds == -1).astype(int)

    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    roc_auc = roc_auc_score(y_test, anomaly_scores_100)
    pr_auc = average_precision_score(y_test, anomaly_scores_100)

    # Sanity verify metric relationships
    expected_prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    expected_rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    assert abs(precision - expected_prec) < 1e-3, "Precision discrepancy with confusion matrix"
    assert abs(recall - expected_rec) < 1e-3, "Recall discrepancy with confusion matrix"

    report = {
        "model_type": "IsolationForest",
        "version": "1.1.0",
        "currency": "INR",
        "algorithm": "Unsupervised Tree-based Anomaly Isolation",
        "trained_at": datetime.utcnow().isoformat(),
        "dataset_type": "synthetic_digital_payments",
        "synthetic_data_disclaimer": "Metrics are evaluated strictly on synthetic demonstration data and do not establish live production fraud performance.",
        "training_samples": len(X_train),
        "holdout_samples": len(X_test),
        "holdout_fraud_samples": int(sum(y_test)),
        "contamination": contamination,
        "features": FEATURE_NAMES,
        "metrics": {
            "precision": round(float(precision), 4),
            "recall": round(float(recall), 4),
            "f1_score": round(float(f1), 4),
            "false_positive_rate": round(float(fpr), 4),
            "roc_auc": round(float(roc_auc), 4),
            "pr_auc": round(float(pr_auc), 4),
            "confusion_matrix": {
                "true_negatives": int(tn),
                "false_positives": int(fp),
                "false_negatives": int(fn),
                "true_positives": int(tp),
            },
        },
        "score_calibration": {
            "decision_min": float(min_d),
            "decision_max": float(max_d),
            "anomaly_threshold_50": round(float(np.percentile(anomaly_scores_100, 95)), 2),
        },
    }

    # Persist model artifact
    joblib.dump(
        {
            "model": model,
            "version": "1.1.0",
            "currency": "INR",
            "features": FEATURE_NAMES,
            "score_calibration": report["score_calibration"],
            "trained_at": report["trained_at"],
        },
        MODEL_PATH,
    )
    print(f"Model artifact saved to: {MODEL_PATH}")

    with open(METRICS_PATH, "w") as f:
        json.dump(report, f, indent=2)
    print(f"Evaluation report written to: {METRICS_PATH}")

    print("\n========== EVALUATION SUMMARY ==========")
    print(f"Precision: {report['metrics']['precision'] * 100:.2f}%")
    print(f"Recall:    {report['metrics']['recall'] * 100:.2f}%")
    print(f"F1-Score:  {report['metrics']['f1_score']:.4f}")
    print(f"FPR:       {report['metrics']['false_positive_rate'] * 100:.2f}%")
    print(f"ROC-AUC:   {report['metrics']['roc_auc']:.4f}")
    print(f"PR-AUC:    {report['metrics']['pr_auc']:.4f}")
    print(f"Confusion Matrix: TN={tn}, FP={fp}, FN={fn}, TP={tp}")
    print("========================================\n")

    return report


if __name__ == "__main__":
    train_and_evaluate()
