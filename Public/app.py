from flask import Flask, request, jsonify, render_template, redirect, url_for

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index_new.html')

@app.route('/vasovue')
def vasovue():
    return render_template('index_new.html')

@app.route('/report')
def report():
    return render_template('report.html')

@app.route('/api/predict', methods=['POST'])
def predict():
    data = request.json
    
    # Handle both old and new data formats
    if 'signal' in data:
        # New rPPG signal format
        signal = data.get('signal', [])
        emotion = data.get('emotion', 'neutral')
        
        # Simple mock prediction based on signal statistics
        if len(signal) >= 100:
            mean_signal = sum(signal) / len(signal)
            # Mock BP calculation (replace with actual ML model)
            systolic = min(160, max(90, 120 + (mean_signal - 128) * 0.3))
            diastolic = min(100, max(60, 80 + (mean_signal - 128) * 0.2))
        else:
            return jsonify({'error': 'Insufficient signal data'}), 400
    else:
        # Legacy format
        systolic = data.get('systolic')
        diastolic = data.get('diastolic')
        
        if systolic is None or diastolic is None:
            return jsonify({'error': 'Invalid input'}), 400

    category = determine_bp_category(systolic, diastolic)
    result = {
        'systolic': round(systolic, 1),
        'diastolic': round(diastolic, 1),
        'category': category,
        'success': True
    }

    return jsonify(result)

@app.route('/api/export', methods=['POST'])
def export_session():
    """Handle session data export"""
    data = request.json
    
    # Log the exported data (in production, you might save to database)
    print(f"Session exported: {len(data.get('samples', []))} samples")
    
    return jsonify({'success': True, 'message': 'Session data exported successfully'})

def determine_bp_category(systolic, diastolic):
    if systolic < 120 and diastolic < 80:
        return "Normal"
    elif 120 <= systolic < 130 and diastolic < 80:
        return "Elevated"
    elif 130 <= systolic < 140 or 80 <= diastolic < 90:
        return "Hypertension Stage 1"
    elif systolic >= 140 or diastolic >= 90:
        return "Hypertension Stage 2"
    else:
        return "Unknown"

@app.route('/results')
def results():
    return render_template('results.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)