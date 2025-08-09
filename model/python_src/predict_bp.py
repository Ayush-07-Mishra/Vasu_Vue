import sys
import os
import json
import joblib
import numpy as np

def load_bp_model():
    model_path = r'/Users/ayushmishra/Desktop/Bp_prediction_recommendation_system/model/python_src/models/bp_predictor.pkl'
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found at {model_path}")
    return joblib.load(model_path)

MODEL = load_bp_model()

def predict_bp(features):
    features = np.array(features).reshape(1, -1)
    preds = MODEL.predict(features)
    return preds[0]

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No features provided"}))
        sys.exit(1)
    features = json.loads(sys.argv[1])
    result = predict_bp(features)
    # If your model predicts both systolic and diastolic
    print(json.dumps({"systolic": float(result[0]), "diastolic": float(result[1])}))