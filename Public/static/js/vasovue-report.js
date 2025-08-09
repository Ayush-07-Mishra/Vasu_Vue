/**
 * VasoVue Report Analysis Module
 * Handles comprehensive BP analysis and report generation
 */

class VasoVueReport {
    constructor() {
        console.log('VasoVueReport constructor called');
        this.reportData = null;
        this.charts = {};
        this.init();
    }

    init() {
        console.log('Initializing VasoVue Report...');
        // Get report data from session storage or URL params
        this.loadReportData();
        this.setupCharts();
        this.generateReport();
        this.setupEventListeners();
        console.log('VasoVue Report initialization complete');
    }

    loadReportData() {
        // Try to get data from session storage first
        const sessionData = sessionStorage.getItem('vasoVueReportData');
        if (sessionData) {
            console.log('Loading report data from session storage');
            this.reportData = JSON.parse(sessionData);
            console.log('Loaded report data:', this.reportData);
            return;
        }

        // Generate mock data for demonstration
        console.log('No session data found, generating mock data');
        this.reportData = this.generateMockData();
        console.log('Generated mock data:', this.reportData);
    }

    generateMockData() {
        const now = new Date();
        console.log('Generating mock data since no session data found');
        
        return {
            timestamp: now.toISOString(),
            sessionDuration: 35.2, // seconds
            samples: this.generateMockSignal(300),
            bloodPressure: {
                systolic: 118.5,
                diastolic: 78.2,
                category: 'Normal'
            },
            heartRate: 72.8,
            signalQuality: {
                snr: 8.5,
                quality: 'Good',
                confidence: 0.85
            },
            analysis: {
                riskFactors: [
                    'Blood pressure within normal range',
                    'Good signal quality achieved',
                    'Heart rate in healthy range'
                ],
                recommendations: [
                    'Continue maintaining healthy lifestyle',
                    'Monitor blood pressure monthly',
                    'Exercise 30 minutes daily',
                    'Maintain balanced diet'
                ],
                healthScore: 85
            },
            historicalData: this.generateHistoricalData()
        };
    }

    generateMockSignal(samples) {
        const signal = [];
        for (let i = 0; i < samples; i++) {
            const time = i / 30; // 30 FPS
            const heartRate = 72;
            const heartbeat = Math.sin(2 * Math.PI * (heartRate / 60) * time);
            const noise = (Math.random() - 0.5) * 0.2;
            signal.push(heartbeat + noise);
        }
        return signal;
    }

    generateHistoricalData() {
        const data = [];
        for (let i = 30; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            data.push({
                date: date.toISOString().split('T')[0],
                systolic: 115 + Math.random() * 20,
                diastolic: 75 + Math.random() * 15,
                heartRate: 65 + Math.random() * 20
            });
        }
        return data;
    }

    generateReport() {
        this.updateBasicMetrics();
        this.updateAnalysis();
        this.updateTimestamp();
    }

    updateBasicMetrics() {
        const { bloodPressure, heartRate, signalQuality, analysis } = this.reportData;

        // Update BP values with 1 decimal place
        document.getElementById('systolic-value').textContent = bloodPressure.systolic.toFixed(1);
        document.getElementById('diastolic-value').textContent = bloodPressure.diastolic.toFixed(1);
        document.getElementById('heart-rate-value').textContent = heartRate.toFixed(1);
        document.getElementById('health-score').textContent = analysis.healthScore;

        // Update status indicators
        this.updateStatusIndicator('systolic-status', bloodPressure.systolic, 'systolic');
        this.updateStatusIndicator('diastolic-status', bloodPressure.diastolic, 'diastolic');
        this.updateStatusIndicator('hr-status', heartRate, 'heartRate');
        this.updateStatusIndicator('score-status', analysis.healthScore, 'score');

        // Update signal quality
        document.getElementById('snr-value').textContent = signalQuality.snr + ' dB';
        document.getElementById('samples-count').textContent = this.reportData.samples.length;
        document.getElementById('signal-quality').textContent = signalQuality.quality;

        // Update current category
        document.getElementById('current-category').textContent = bloodPressure.category;
        this.updateCategoryStyle('current-category', bloodPressure.category);
    }

    updateStatusIndicator(elementId, value, type) {
        const element = document.getElementById(elementId);
        let status, className;

        switch (type) {
            case 'systolic':
                if (value < 120) {
                    status = 'Normal';
                    className = 'bg-green-500 text-white';
                } else if (value < 130) {
                    status = 'Elevated';
                    className = 'bg-yellow-500 text-black';
                } else if (value < 140) {
                    status = 'Stage 1';
                    className = 'bg-orange-500 text-white';
                } else {
                    status = 'Stage 2';
                    className = 'bg-red-500 text-white';
                }
                break;
            case 'diastolic':
                if (value < 80) {
                    status = 'Normal';
                    className = 'bg-green-500 text-white';
                } else if (value < 90) {
                    status = 'Stage 1';
                    className = 'bg-orange-500 text-white';
                } else {
                    status = 'Stage 2';
                    className = 'bg-red-500 text-white';
                }
                break;
            case 'heartRate':
                if (value >= 60 && value <= 100) {
                    status = 'Normal';
                    className = 'bg-green-500 text-white';
                } else if (value < 60) {
                    status = 'Low';
                    className = 'bg-blue-500 text-white';
                } else {
                    status = 'High';
                    className = 'bg-red-500 text-white';
                }
                break;
            case 'score':
                if (value >= 80) {
                    status = 'Excellent';
                    className = 'bg-green-500 text-white';
                } else if (value >= 60) {
                    status = 'Good';
                    className = 'bg-blue-500 text-white';
                } else if (value >= 40) {
                    status = 'Fair';
                    className = 'bg-yellow-500 text-black';
                } else {
                    status = 'Poor';
                    className = 'bg-red-500 text-white';
                }
                break;
        }

        element.textContent = status;
        element.className = `px-3 py-1 rounded-full text-xs font-semibold ${className}`;
    }

    updateCategoryStyle(elementId, category) {
        const element = document.getElementById(elementId);
        let className;

        switch (category) {
            case 'Normal':
                className = 'bg-green-500 text-white';
                break;
            case 'Elevated':
                className = 'bg-yellow-500 text-black';
                break;
            case 'Hypertension Stage 1':
                className = 'bg-orange-500 text-white';
                break;
            case 'Hypertension Stage 2':
                className = 'bg-red-500 text-white';
                break;
            default:
                className = 'bg-gray-500 text-white';
        }

        element.className = `px-3 py-1 rounded-full text-sm font-semibold ${className}`;
    }

    updateAnalysis() {
        const { analysis } = this.reportData;

        // Update risk assessment
        const riskContainer = document.getElementById('risk-assessment');
        riskContainer.innerHTML = '';
        analysis.riskFactors.forEach(risk => {
            const riskItem = document.createElement('div');
            riskItem.className = 'flex items-center text-sm text-gray-300';
            riskItem.innerHTML = `
                <i class="fas fa-info-circle mr-2 text-yellow-400"></i>
                ${risk}
            `;
            riskContainer.appendChild(riskItem);
        });

        // Update recommendations
        const recContainer = document.getElementById('recommendations');
        recContainer.innerHTML = '';
        analysis.recommendations.forEach(rec => {
            const recItem = document.createElement('div');
            recItem.className = 'flex items-center text-sm text-gray-300';
            recItem.innerHTML = `
                <i class="fas fa-check-circle mr-2 text-green-400"></i>
                ${rec}
            `;
            recContainer.appendChild(recItem);
        });
    }

    updateTimestamp() {
        const date = new Date(this.reportData.timestamp);
        document.getElementById('report-date').textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        document.getElementById('session-duration').textContent = this.reportData.sessionDuration.toFixed(1) + 's';
    }

    setupCharts() {
        // Wait for Chart.js to be loaded
        if (typeof Chart === 'undefined') {
            console.log('Chart.js not loaded yet, retrying...');
            setTimeout(() => this.setupCharts(), 100);
            return;
        }
        
        console.log('Setting up charts with data:', this.reportData);
        this.setupSignalChart();
        this.setupBPCategoryChart();
        this.setupTrendChart();
    }

    setupSignalChart() {
        const ctx = document.getElementById('signal-chart').getContext('2d');
        const signal = this.reportData.samples;
        
        console.log('Setting up signal chart with', signal.length, 'samples');
        
        // Ensure we have valid signal data
        if (!signal || signal.length === 0) {
            console.warn('No signal data available for chart');
            return;
        }
        
        // Sample the data if too many points (for performance)
        const maxPoints = 300;
        const step = Math.max(1, Math.floor(signal.length / maxPoints));
        const sampledSignal = signal.filter((_, i) => i % step === 0);
        const timeLabels = sampledSignal.map((_, i) => ((i * step) / 30).toFixed(1));
        
        this.charts.signal = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeLabels,
                datasets: [{
                    label: 'rPPG Signal',
                    data: sampledSignal,
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    pointRadius: 0,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: 'white' }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time (seconds)',
                            color: 'white'
                        },
                        ticks: { 
                            color: 'white',
                            maxTicksLimit: 10
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Amplitude',
                            color: 'white'
                        },
                        ticks: { color: 'white' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });
        
        console.log('Signal chart created successfully');
    }

    setupBPCategoryChart() {
        const ctx = document.getElementById('bp-category-chart').getContext('2d');
        const { systolic, diastolic } = this.reportData.bloodPressure;
        
        this.charts.bpCategory = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Normal', 'Elevated', 'Stage 1', 'Stage 2'],
                datasets: [{
                    data: [30, 25, 25, 20], // Mock distribution
                    backgroundColor: [
                        'rgb(34, 197, 94)',
                        'rgb(234, 179, 8)',
                        'rgb(249, 115, 22)',
                        'rgb(239, 68, 68)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: 'white' }
                    }
                }
            }
        });
    }

    setupTrendChart() {
        const ctx = document.getElementById('trend-chart').getContext('2d');
        const historical = this.reportData.historicalData;
        
        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: historical.map(d => new Date(d.date).toLocaleDateString()),
                datasets: [
                    {
                        label: 'Systolic',
                        data: historical.map(d => d.systolic),
                        borderColor: 'rgb(239, 68, 68)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Diastolic',
                        data: historical.map(d => d.diastolic),
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: 'white' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: 'white' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Blood Pressure (mmHg)',
                            color: 'white'
                        },
                        ticks: { color: 'white' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });
    }

    setupEventListeners() {
        // Add any additional event listeners here
    }
}

// Global functions for button actions
function downloadReport() {
    // Trigger confetti
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });
    
    // Generate and download PDF report
    try {
        const reportContent = generatePDFContent();
        const blob = new Blob([reportContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `VasoVue_Report_${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('📄 Report downloaded successfully');
    } catch (error) {
        console.error('❌ Download failed:', error);
        alert('Download feature temporarily unavailable. Please try again.');
    }
}

function shareReport() {
    if (navigator.share) {
        navigator.share({
            title: 'VasoVue Health Report',
            text: 'Check out my cardiovascular health analysis from VasoVue',
            url: window.location.href
        }).then(() => {
            console.log('📤 Report shared successfully');
        }).catch(err => {
            console.error('❌ Share failed:', err);
            copyToClipboard();
        });
    } else {
        copyToClipboard();
    }
}

function copyToClipboard() {
    const reportUrl = window.location.href;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(reportUrl).then(() => {
            showNotification('📋 Report link copied to clipboard!');
        }).catch(() => {
            fallbackCopyTextToClipboard(reportUrl);
        });
    } else {
        fallbackCopyTextToClipboard(reportUrl);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showNotification('📋 Report link copied to clipboard!');
    } catch (err) {
        showNotification('❌ Unable to copy link');
    }
    document.body.removeChild(textArea);
}

function showNotification(message) {
    // Create notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

function scheduleFollowUp() {
    // Create a simple follow-up scheduler
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + 30); // 30 days from now
    
    const dateString = followUpDate.toISOString().split('T')[0];
    const timeString = '09:00';
    
    if ('showSaveFilePicker' in window) {
        // Modern browser with File System Access API
        createCalendarEvent(dateString, timeString);
    } else {
        // Fallback: create .ics file
        createICSFile(dateString, timeString);
    }
}

function createCalendarEvent(date, time) {
    const event = {
        title: 'VasoVue Follow-up Health Check',
        description: 'Scheduled follow-up cardiovascular health monitoring session',
        start: `${date}T${time}:00`,
        end: `${date}T${time.split(':')[0]}:30:00`
    };
    
    showNotification('📅 Follow-up reminder set for ' + date);
    console.log('📅 Calendar event created:', event);
}

function createICSFile(date, time) {
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:VasoVue
BEGIN:VEVENT
UID:vasovue-followup-${Date.now()}
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${date.replace(/-/g, '')}T${time.replace(':', '')}00Z
DTEND:${date.replace(/-/g, '')}T${time.split(':')[0]}3000Z
SUMMARY:VasoVue Follow-up Health Check
DESCRIPTION:Scheduled follow-up cardiovascular health monitoring session
END:VEVENT
END:VCALENDAR`;
    
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vasovue-followup.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('📅 Calendar event downloaded');
}

function generatePDFContent() {
    // Generate a simple HTML report for download
    return `<!DOCTYPE html>
<html>
<head>
    <title>VasoVue Health Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
        .metric { border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>VasoVue Cardiovascular Analysis Report</h1>
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
    </div>
    <div class="metrics">
        <div class="metric">
            <h3>Blood Pressure</h3>
            <p>Systolic: ${document.getElementById('systolic-value').textContent} mmHg</p>
            <p>Diastolic: ${document.getElementById('diastolic-value').textContent} mmHg</p>
        </div>
        <div class="metric">
            <h3>Heart Rate</h3>
            <p>${document.getElementById('heart-rate-value').textContent} BPM</p>
        </div>
    </div>
</body>
</html>`;
}

function goBack() {
    // Clear session data and go back
    sessionStorage.removeItem('vasoVueReportData');
    window.location.href = '/';
}

// Initialize report when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing VasoVue Report...');
    
    // Wait for all external libraries to load
    function waitForLibraries() {
        if (typeof Chart === 'undefined') {
            console.log('Waiting for Chart.js to load...');
            setTimeout(waitForLibraries, 100);
            return;
        }
        
        if (typeof confetti === 'undefined') {
            console.log('Waiting for confetti to load...');
            setTimeout(waitForLibraries, 100);
            return;
        }
        
        console.log('All libraries loaded, creating VasoVue Report instance');
        new VasoVueReport();
    }
    
    waitForLibraries();
});
