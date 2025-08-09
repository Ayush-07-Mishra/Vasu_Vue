class VideoRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.recordedBlobs = [];
        this.recordingInterval = null;
    }

    async start(stream, duration = 30000) {
        try {
            this.recordedBlobs = [];
            const options = { mimeType: 'video/webm;codecs=vp9' };
            
            this.mediaRecorder = new MediaRecorder(stream, options);
            
            this.mediaRecorder.ondataavailable = event => {
                if (event.data && event.data.size > 0) {
                    this.recordedBlobs.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.saveRecording();
            };
            
            this.mediaRecorder.start(100);
            
            setTimeout(() => {
                if (this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.stop();
                }
            }, duration);
            
        } catch (error) {
            console.error('Recording error:', error);
            throw error;
        }
    }

    stop() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
        if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
        }
    }

    async saveRecording() {
        try {
            const blob = new Blob(this.recordedBlobs, { type: 'video/webm' });
            const formData = new FormData();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `recording_${timestamp}.webm`;
            
            formData.append('video', blob, filename);
            
            const response = await fetch('/api/upload-recording', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Failed to upload recording');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error saving recording:', error);
            throw error;
        }
    }
}

export default VideoRecorder;