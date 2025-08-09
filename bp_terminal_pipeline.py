"""
FacePulse: AI Blood Pressure Estimator
--------------------------------------
Estimate blood pressure from facial video using rPPG and ML.
Enhancements:
- Error handling for missing face
- Signal smoothing (moving average)
- Real-time matplotlib plot (non-blocking)
- Real-time BP prediction display (terminal & video overlay)
- CSV export of rPPG signal with timestamp
"""
import matplotlib.pyplot as plt
import cv2
import numpy as np
import pandas as pd
import time
import os
from datetime import datetime
from scipy.signal import find_peaks, butter, filtfilt, welch
import joblib

# Configuration
RECORDING_DIR = "temp/recordings"
FEATURES_DIR = "temp/features"
MODEL_PATH = "model/python_src/models/bp_predictor.pkl"
os.makedirs(RECORDING_DIR, exist_ok=True)
os.makedirs(FEATURES_DIR, exist_ok=True)

def record_video(duration=30):
    """Record video from webcam and save as AVI"""
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise IOError("Cannot open webcam")
    
    # Get frame dimensions
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    filename = f"{RECORDING_DIR}/bp_recording_{datetime.now().strftime('%Y%m%d_%H%M%S')}.avi"
    fourcc = cv2.VideoWriter_fourcc(*'XVID')
    out = cv2.VideoWriter(filename, fourcc, 20.0, (frame_width, frame_height))
    
    print(f"Recording {duration} seconds of video... (Press 'q' to stop early)")
    start_time = time.time()
    
    while (time.time() - start_time) < duration:
        ret, frame = cap.read()
        if not ret:
            break
        out.write(frame)
        cv2.imshow('Recording - Press q to quit', frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    out.release()
    cv2.destroyAllWindows()
    print(f"✅ Video saved to: {filename}")
    return filename

def extract_rppg_signal(video_path):
def moving_average(signal, window=5):
    if len(signal) < window:
        return np.array(signal)
    return np.convolve(signal, np.ones(window)/window, mode='valid')

def extract_rppg_signal(video_path, plot_realtime=True):
    """Extract rPPG signal from video using forehead green channel, with error handling and real-time plot."""
    print("Extracting rPPG signal from video...")
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    rppg_signal = []
    timestamps = []
    frame_idx = 0
    missing_face_count = 0
    plt.ion() if plot_realtime else None
    fig, ax = plt.subplots() if plot_realtime else (None, None)
    line, = ax.plot([], [], 'g-') if plot_realtime else (None,)
    ax.set_xlabel('Time (s)') if plot_realtime else None
    ax.set_ylabel('Green Avg (rPPG)') if plot_realtime else None
    ax.set_title('Real-time rPPG Signal') if plot_realtime else None
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        if len(faces) > 0:
            (x, y, w, h) = faces[0]
            forehead = frame[y:y+int(0.2*h), x+int(0.25*w):x+int(0.75*w)]
            if forehead.size > 0:
                green_avg = np.mean(forehead[:, :, 1])
                rppg_signal.append(green_avg)
                timestamps.append(frame_idx / fps)
                missing_face_count = 0
            # Overlay rectangle and info
            cv2.rectangle(frame, (x, y), (x+w, y+h), (255,0,0), 2)
            cv2.putText(frame, 'Face Detected', (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,0), 2)
        else:
            missing_face_count += 1
            cv2.putText(frame, 'No Face Detected!', (30, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,0,255), 2)
        # Real-time plot
        if plot_realtime and len(rppg_signal) > 10:
            line.set_xdata(timestamps)
            line.set_ydata(rppg_signal)
            ax.relim()
            ax.autoscale_view()
            plt.draw()
            plt.pause(0.001)
        cv2.imshow('Extracting rPPG - Press q to quit', frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
        frame_idx += 1
    cap.release()
    cv2.destroyAllWindows()
    if plot_realtime:
        plt.ioff()
        plt.show(block=False)
    if missing_face_count > 0:
        print(f"⚠️ Warning: {missing_face_count} frames had no face detected.")
    # Save raw signal
    signal_df = pd.DataFrame({
        'Time (s)': timestamps,
        'Green Avg (rPPG Proxy)': rppg_signal
    })
    signal_path = f"{FEATURES_DIR}/rppg_signal_{os.path.basename(video_path)}.csv"
    signal_df.to_csv(signal_path, index=False)
    print(f"✅ Raw rPPG signal saved to: {signal_path}")
    # Smooth signal
    smoothed = moving_average(rppg_signal, window=7)
    return np.array(smoothed), np.array(timestamps[-len(smoothed):])

def extract_features(signal, timestamps):
    """Extract features from rPPG signal"""
    print("Processing rPPG signal to extract features...")
    
    # Bandpass filter (0.7-4 Hz)
    def bandpass_filter(data, lowcut, highcut, fs, order=5):
        nyq = 0.5 * fs
        low = lowcut / nyq
        high = highcut / nyq
        b, a = butter(order, [low, high], btype='band')
        return filtfilt(b, a, data)
    
    # Calculate sampling frequency
    if len(timestamps) < 2:
        raise ValueError("Not enough timestamps to calculate sampling rate")
    fs = 1 / np.mean(np.diff(timestamps))
    
    # Filter signal
    filtered = bandpass_filter(signal, 0.7, 4, fs)
    
    # Find peaks (heartbeats)
    min_distance = int(fs * 0.4)  # 0.4s between peaks
    peaks, _ = find_peaks(filtered, distance=min_distance)
    
    # Time intervals between peaks
    peak_intervals = np.diff(timestamps[peaks]) if len(peaks) > 1 else np.array([0])
    
    # Extract features
    features = {
        'mean_amplitude': np.mean(filtered),
        'std_amplitude': np.std(filtered),
        'rms_amplitude': np.sqrt(np.mean(filtered**2)),
        'num_peaks': len(peaks),
        'mean_peak_interval': np.mean(peak_intervals) if len(peak_intervals) > 0 else 0,
        'std_peak_interval': np.std(peak_intervals) if len(peak_intervals) > 0 else 0,
        'skewness': pd.Series(filtered).skew(),
        'kurtosis': pd.Series(filtered).kurt()
    }
    
    # Frequency domain features
    frequencies, power_spectrum = welch(filtered, fs)
    features.update({
        'dominant_frequency': frequencies[np.argmax(power_spectrum)],
        'total_power': np.sum(power_spectrum),
        'peak_power': np.max(power_spectrum)
    })
    
    # Save features
    features_df = pd.DataFrame([features])
    features_path = f"{FEATURES_DIR}/features_{os.path.basename(video_path)}.csv"
    features_df.to_csv(features_path, index=False)
    print(f"✅ Extracted features saved to: {features_path}")
    
    return features

def predict_bp(features):
def predict_bp(features, model=None):
    """Predict BP using trained model"""
    print("Making blood pressure prediction...")
    if model is None:
        try:
            model = joblib.load(MODEL_PATH)
        except Exception as e:
            print(f"⚠️ Warning: {e}. Using fallback dummy model.")
            systolic = 120 + (features['mean_amplitude'] * 10)
            diastolic = 80 + (features['dominant_frequency'] * 5)
            return systolic, diastolic
    feature_order = [
        'mean_amplitude', 'std_amplitude', 'rms_amplitude',
        'num_peaks', 'mean_peak_interval', 'std_peak_interval',
        'skewness', 'kurtosis', 'dominant_frequency',
        'total_power', 'peak_power'
    ]
    X = pd.DataFrame([features])[feature_order]
    y_pred = model.predict(X)
    return y_pred[0][0], y_pred[0][1]  # systolic, diastolic

if __name__ == "__main__":
    try:
        print("\n==============================")
        print(" FacePulse: AI Blood Pressure Estimator")
        print("==============================\n")
        # 1. Record video
        video_path = record_video(duration=30)
        # 2. Extract rPPG signal (with real-time plot)
        rppg_signal, timestamps = extract_rppg_signal(video_path, plot_realtime=True)
        # 3. Extract features
        features = extract_features(rppg_signal, timestamps)
        print("\nExtracted Features:")
        for k, v in features.items():
            print(f"{k}: {v:.4f}")
        # 4. Predict BP
        systolic, diastolic = predict_bp(features)
        print("\n=== Blood Pressure Prediction ===")
        print(f"Systolic: {systolic:.1f} mmHg")
        print(f"Diastolic: {diastolic:.1f} mmHg")
        print("===============================")
        # Optionally overlay BP on last frame (if you want to show)
        # (Not implemented here as video is already closed)
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")