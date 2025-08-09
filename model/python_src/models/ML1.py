import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import joblib

def load_data(csv_path):
    """Load and prepare training data"""
    df = pd.read_csv(csv_path)
    
    # Verify we have 102 features + 2 targets
    if df.shape[1] != 104:
        raise ValueError(f"Expected 104 columns (102 features + 2 targets), got {df.shape[1]}")
    
    X = df.iloc[:, :-2]  # First 102 columns are features
    y = df.iloc[:, -2:]  # Last 2 columns are systolic and diastolic BP
    
    return X, y

def train_model(X, y):
    """Train and evaluate the model"""
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    # Create pipeline with scaling and model
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('model', RandomForestRegressor(
            n_estimators=200,
            max_depth=15,
            min_samples_split=5,
            random_state=42,
            n_jobs=-1
        ))
    ])
    
    # Train
    pipeline.fit(X_train, y_train)
    
    # Evaluate
    y_pred = pipeline.predict(X_test)
    mae_systolic = mean_absolute_error(y_test.iloc[:, 0], y_pred[:, 0])
    mae_diastolic = mean_absolute_error(y_test.iloc[:, 1], y_pred[:, 1])
    
    print(f"Systolic MAE: {mae_systolic:.2f} mmHg")
    print(f"Diastolic MAE: {mae_diastolic:.2f} mmHg")
    
    return pipeline

def main():
    try:
        # Load data
        data_path = 'path/to/your/training_data.csv'  # Update this path
        X, y = load_data(data_path)
        
        # Train model
        model = train_model(X, y)
        
        # Save model
        joblib.dump(model, 'bp_predictor.pkl')
        print("✅ Model trained and saved successfully")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()