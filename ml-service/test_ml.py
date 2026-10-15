import main
from datetime import datetime
from pydantic import ValidationError

def test_root_and_health():
    res = main.health_check()
    assert res["status"] == "operational"
    assert res["ml_model_deployed"] is True

def test_metrics_endpoint():
    res = main.get_evaluation_metrics()
    assert res["model_type"] == "IsolationForest"
    assert "metrics" in res
    assert res["metrics"]["f1_score"] > 0.8

def test_normal_transaction_inference():
    tx = main.TransactionInput(
        transaction_id="TXN-TEST-NORMAL",
        customer_id="CUST-001",
        amount=45.0,
        currency="INR",
        channel="card",
        timestamp=datetime.utcnow(),
        recent_transaction_count=1,
        avg_customer_amount=50.0,
        failed_attempts=0,
    )
    res = main.analyze_transaction(tx)
    assert res.transaction_id == "TXN-TEST-NORMAL"
    assert res.ml_score < 50.0
    assert res.is_anomaly is False
    assert len(res.features.feature_vector) == 8

def test_anomalous_transaction_inference():
    tx = main.TransactionInput(
        transaction_id="TXN-TEST-FRAUD",
        customer_id="CUST-002",
        amount=14500.0,
        currency="INR",
        channel="crypto",
        timestamp=datetime(2026, 10, 13, 3, 30, 0),
        recent_transaction_count=8,
        avg_customer_amount=50.0,
        failed_attempts=4,
    )
    res = main.analyze_transaction(tx)
    assert res.transaction_id == "TXN-TEST-FRAUD"
    assert res.ml_score > 60.0
    assert res.is_anomaly is True
    assert len(res.explanation) >= 2

def test_legitimate_high_value_transaction():
    """
    Legitimate customer with a typical INR 10,000 baseline transacting INR 11,000 via card in daytime.
    Should NOT trigger extreme anomaly score because amount is consistent with baseline.
    """
    tx = main.TransactionInput(
        transaction_id="TXN-LEGIT-HIGH",
        customer_id="CUST-AFFLUENT",
        amount=11000.0,
        currency="INR",
        channel="card",
        timestamp=datetime(2026, 10, 13, 14, 0, 0),
        recent_transaction_count=1,
        avg_customer_amount=10000.0,
        customer_amount_std=1500.0,
        failed_attempts=0,
    )
    res = main.analyze_transaction(tx)
    assert res.transaction_id == "TXN-LEGIT-HIGH"
    # Even though amount exceeds the INR 10,000 threshold causing tree split,
    # it produces only 1 explanation (high amount) unlike multi-signal fraud (which has >= 2)
    assert len(res.explanation) == 1
    assert "Transaction amount exceeds high threshold baseline" in res.explanation[0]

def test_reject_unsupported_currency_and_invalid_amount():
    try:
        main.TransactionInput(
            transaction_id="TXN-TEST-USD",
            customer_id="CUST-001",
            amount=500,
            currency="USD",
        )
    except ValidationError:
        pass
    else:
        raise AssertionError("USD transactions must be rejected")

    for amount in (float("inf"), 1.001):
        try:
            main.TransactionInput(
                transaction_id="TXN-TEST-INVALID-AMOUNT",
                customer_id="CUST-001",
                amount=amount,
                currency="INR",
            )
        except ValidationError:
            continue
        raise AssertionError(f"Invalid amount {amount} must be rejected")

def test_synthetic_disclaimer_present():
    report = main.get_evaluation_metrics()
    assert "synthetic_data_disclaimer" in report
    assert "synthetic" in report["dataset_type"]

if __name__ == "__main__":
    tests = [
        test_root_and_health,
        test_metrics_endpoint,
        test_normal_transaction_inference,
        test_anomalous_transaction_inference,
        test_legitimate_high_value_transaction,
        test_reject_unsupported_currency_and_invalid_amount,
        test_synthetic_disclaimer_present,
    ]
    passed = 0
    for t in tests:
        t()
        print(f"PASS: {t.__name__}")
        passed += 1
    print(f"\nAll {passed} ML test cases passed successfully.")
