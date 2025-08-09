document.addEventListener('DOMContentLoaded', function() {
    const loadingState = document.getElementById('loadingState');
    const resultsContainer = document.getElementById('resultsContainer');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText') || errorMessage;
    const systolicValue = document.getElementById('systolicValue');
    const diastolicValue = document.getElementById('diastolicValue');
    const bpCategory = document.getElementById('bpCategory');
    const detectedEmotion = document.getElementById('detectedEmotion');
    const suggestionsList = document.getElementById('suggestionsList');

    loadingState.style.display = 'block';
    resultsContainer.style.display = 'none';
    errorMessage.style.display = 'none';

    function determineBPCategory(systolic, diastolic) {
        if (systolic < 120 && diastolic < 80) {
            return { name: 'Normal', className: 'normal', emoji: '🟢' };
        } else if (systolic >= 120 && systolic < 130 && diastolic < 80) {
            return { name: 'Elevated', className: 'elevated', emoji: '🟡' };
        } else if ((systolic >= 130 && systolic < 140) || (diastolic >= 80 && diastolic < 90)) {
            return { name: 'Hypertension Stage 1', className: 'hypertension-1', emoji: '🟠' };
        } else if (systolic >= 140 || diastolic >= 90) {
            return { name: 'Hypertension Stage 2', className: 'hypertension-2', emoji: '🔴' };
        } else {
            return { name: 'Unknown', className: 'unknown', emoji: '❓' };
        }
    }

    function getPersonalizedSuggestions(category, emotion) {
        const base = [
            "Maintain a balanced diet rich in fruits and vegetables.",
            "Stay active—regular exercise is great for your heart!",
            "Get enough quality sleep every night.",
            "Keep hydrated and manage stress with relaxation techniques."
        ];
        const extra = [];
        if (category === 'Normal') {
            extra.push("Fantastic! Keep up your healthy lifestyle. 😊");
        } else if (category === 'Elevated') {
            extra.push("You're on the right track—small changes can make a big difference!");
            extra.push("Consider reducing salt intake and monitoring your BP regularly.");
        } else if (category === 'Hypertension Stage 1') {
            extra.push("A few lifestyle tweaks can help bring your BP down. Stay positive!");
            extra.push("Try brisk walking, yoga, or meditation for stress relief.");
        } else if (category === 'Hypertension Stage 2') {
            extra.push("Don't worry—every step counts! Consult your doctor for guidance.");
            extra.push("Focus on healthy habits and regular checkups.");
        }
        // Emotion-based suggestions
        if (emotion === 'happy') {
            extra.push("Your positive mood is great for your heart! Keep smiling! 😄");
        } else if (emotion === 'sad') {
            extra.push("Remember, brighter days are ahead. Take care of your emotional well-being.");
        } else if (emotion === 'angry') {
            extra.push("Try deep breathing or a calming walk to relax.");
        } else if (emotion === 'neutral') {
            extra.push("Stay mindful and keep up the good work!");
        }
        return [...base, ...extra];
    }

    function getMotivation(category, emotion) {
        if (category === 'Normal') {
            return "🎉 Excellent! Your blood pressure is in the healthy range. Keep it up!";
        } else if (category === 'Elevated') {
            return "🌟 You're close to optimal! Small lifestyle changes can help you reach your goal.";
        } else if (category === 'Hypertension Stage 1') {
            return "💪 You have the power to improve your BP. Every healthy choice matters!";
        } else if (category === 'Hypertension Stage 2') {
            return "❤️ Take action today for a healthier tomorrow. You've got this!";
        }
        return "Stay positive and keep caring for your health!";
    }

    try {
        const prediction = JSON.parse(sessionStorage.getItem('bpPrediction'));
        if (!prediction) throw new Error('No prediction found.');

        const systolic = Number(prediction.systolic);
        const diastolic = Number(prediction.diastolic);
        // If emotion is not present, default to 'neutral'
        const emotion = (prediction.emotion || 'neutral').toLowerCase();

        systolicValue.textContent = systolic.toFixed(1);
        diastolicValue.textContent = diastolic.toFixed(1);
        detectedEmotion.textContent = emotion.charAt(0).toUpperCase() + emotion.slice(1);

        // BP Category
        const cat = determineBPCategory(systolic, diastolic);
        bpCategory.textContent = `${cat.emoji} ${cat.name}`;
        bpCategory.className = `bp-category ${cat.className}`;

        // Personalized suggestions
        const suggestions = getPersonalizedSuggestions(cat.name, emotion);
        suggestionsList.innerHTML = suggestions.map(s => `<li class="list-group-item"><i class="fas fa-check-circle text-success me-2"></i>${s}</li>`).join('');

        // Motivational message (optional, if you want to show it somewhere)
        let motivationDiv = document.getElementById('motivationMessage');
        if (!motivationDiv) {
            motivationDiv = document.createElement('div');
            motivationDiv.id = 'motivationMessage';
            motivationDiv.className = 'alert alert-success fs-5 fw-semibold mt-4';
            bpCategory.parentNode.appendChild(motivationDiv);
        }
        motivationDiv.textContent = getMotivation(cat.name, emotion);
        motivationDiv.style.display = 'block';

        // Show results, hide loading
        loadingState.style.display = 'none';
        resultsContainer.style.display = 'block';
    } catch (err) {
        loadingState.style.display = 'none';
        resultsContainer.style.display = 'block';
        errorMessage.style.display = 'block';
        errorText.textContent = err.message;
    }
    function showResults(prediction) {
        systolicValue.textContent = prediction.systolic.toFixed(1);
        diastolicValue.textContent = prediction.diastolic.toFixed(1);
        detectedEmotion.textContent = (prediction.emotion || 'neutral').charAt(0).toUpperCase() + (prediction.emotion || 'neutral').slice(1);

        const cat = determineBPCategory(prediction.systolic, prediction.diastolic);
        bpCategory.textContent = `${cat.emoji} ${cat.name}`;
        bpCategory.className = `bp-category ${cat.className}`;

        const suggestions = getPersonalizedSuggestions(cat.name, prediction.emotion || 'neutral');
        suggestionsList.innerHTML = suggestions.map(s => `<li class="list-group-item"><i class="fas fa-check-circle text-success me-2"></i>${s}</li>`).join('');

        loadingState.style.display = 'none';
        resultsContainer.style.display = 'block';
    }
    
    // 1. Try sessionStorage first (main flow)
    const sessionData = sessionStorage.getItem('bpPrediction');
    const sessionError = sessionStorage.getItem('bpPredictionError');
    if (sessionError) {
        showError(sessionError);
        sessionStorage.removeItem('bpPredictionError');
    } else if (sessionData) {
        try {
            const prediction = JSON.parse(sessionData);
            showResults(prediction);
            sessionStorage.removeItem('bpPrediction');
        } catch (e) {
            showError('Error parsing prediction data.');
        }
    } else {
        // 2. Fallback: fetch from backend (for reloads/bookmarks)
        fetch('/api/predict/result')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data) {
                    showResults(data.data);
                } else {
                    showError('No prediction data found.');
                }
            })
            .catch(() => showError('Failed to fetch prediction data.'));
    }
});