import sys
import numpy as np
import pandas as pd
from scipy.signal import find_peaks, butter, filtfilt, welch

# Accept input and output CSV paths as arguments
if len(sys.argv) > 2:
    input_csv = sys.argv[1]
    output_csv = sys.argv[2]
else:
    raise ValueError("Usage: python Features.py <input_csv> <output_csv>")

df = pd.read_csv(input_csv)
signal = df.iloc[:, 1].values  # 2nd column is rPPG signal
timestamps = df.iloc[:, 0].values  # 1st column is time in seconds

if len(timestamps) < 2:
    raise ValueError("Not enough timestamp data to calculate sampling frequency.")

fs = 1 / np.mean(np.diff(timestamps))  # Sampling frequency

# Example feature extraction (replace with your actual logic)
mean_amplitude = np.mean(signal)
std_amplitude = np.std(signal)
rms_amplitude = np.sqrt(np.mean(signal**2))
peaks, _ = find_peaks(signal)
num_peaks = len(peaks)
peak_intervals = np.diff(timestamps[peaks]) if num_peaks > 1 else [0]
mean_peak_interval = np.mean(peak_intervals) if len(peak_intervals) > 0 else 0
std_peak_interval = np.std(peak_intervals) if len(peak_intervals) > 0 else 0
skewness = pd.Series(signal).skew()
kurtosis = pd.Series(signal).kurtosis()
f, Pxx = welch(signal, fs=fs, nperseg=min(256, len(signal)))
dominant_frequency = f[np.argmax(Pxx)]
total_power = np.sum(Pxx)
peak_power = np.max(Pxx)

features = {
    'mean_amplitude': mean_amplitude,
    'std_amplitude': std_amplitude,
    'rms_amplitude': rms_amplitude,
    'num_peaks': num_peaks,
    'mean_peak_interval': mean_peak_interval,
    'std_peak_interval': std_peak_interval,
    'skewness': skewness,
    'kurtosis': kurtosis,
    'dominant_frequency': dominant_frequency,
    'total_power': total_power,
    'peak_power': peak_power
}

features_df = pd.DataFrame([features])
features_df.to_csv(output_csv, index=False)
print(f"Features extracted and saved to '{output_csv}'")