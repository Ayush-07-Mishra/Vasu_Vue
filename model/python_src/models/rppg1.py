import cv2
import numpy as np
import pandas as pd
import os

# === Parameters ===
video_path = 'rppg.mp4'  # Replace with your actual video file
output_csv = 'rppg_signal_basic.csv'
haar_cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'

# === Load face detector ===
face_cascade = cv2.CascadeClassifier(haar_cascade_path)

# === Open video file ===
cap = cv2.VideoCapture(video_path)
fps = cap.get(cv2.CAP_PROP_FPS)

rppg_signal = []
timestamps = []

frame_idx = 0

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)

    if len(faces) > 0:
        (x, y, w, h) = faces[0]
        # Approximate forehead region: top 20% of face bounding box
        forehead = frame[y:y+int(0.2*h), x+int(0.25*w):x+int(0.75*w)]

        if forehead.size > 0:
            # Average green channel intensity
            green_avg = np.mean(forehead[:, :, 1])
            rppg_signal.append(green_avg)
            timestamps.append(frame_idx / fps)

    frame_idx += 1

cap.release()

# === Save signal to CSV ===
df = pd.DataFrame({
    'Time (s)': timestamps,
    'Green Avg (rPPG Proxy)': rppg_signal
})
df.to_csv(output_csv, index=False)

print(f"✅ rPPG proxy signal saved to {output_csv}")
