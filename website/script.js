/**
 * CareerDNA - Career Discovery Assessment
 * Core Logic and UI Orchestration
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let assessmentData = null;
    let currentQuestionIndex = 0;
    const userResponses = [];
    let studentInfo = {};

    // --- DOM Elements ---
    const screens = {
        welcome: document.getElementById('welcome-screen'),
        assessment: document.getElementById('assessment-screen'),
        results: document.getElementById('results-screen'),
        loading: document.getElementById('loading-screen'),
        error: document.getElementById('error-screen')
    };

    const forms = {
        studentInfo: document.getElementById('student-info-form'),
        assessment: document.getElementById('assessment-form')
    };

    const elements = {
        questionsContainer: document.getElementById('questions-container'),
        progressBar: document.getElementById('progress-bar'),
        progressFill: document.getElementById('progress-fill'),
        progressText: document.getElementById('progress-text'),
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        submitBtn: document.getElementById('submit-btn'),
        resultsSummary: document.getElementById('results-summary'),
        errorMessage: document.getElementById('error-message')
    };

    // --- Initialization ---
    async function init() {
        try {
            showScreen('loading');
            const response = await fetch('data/assessment-v1.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            assessmentData = await response.json();
            showScreen('welcome');
            setupEventListeners();
        } catch (error) {
            console.error('Failed to initialize assessment:', error);
            elements.errorMessage.textContent = error.message;
            showScreen('error');
        }
    }

    function setupEventListeners() {
        forms.studentInfo.addEventListener('submit', handleStudentInfoSubmit);
        forms.assessment.addEventListener('submit', handleAssessmentSubmit);
        elements.prevBtn.addEventListener('click', handlePrev);
        elements.nextBtn.addEventListener('click', handleNext);
        document.getElementById('restart-btn').addEventListener('click', restartAssessment);
        document.getElementById('download-btn').addEventListener('click', downloadResults);
        document.getElementById('retry-btn').addEventListener('click', () => location.reload());
    }

    // --- Navigation Helpers ---
    function showScreen(screenId) {
        Object.values(screens).forEach(screen => {
            screen.classList.add('hidden');
            screen.classList.remove('active');
        });
        const target = screens[screenId];
        target.classList.remove('hidden');
        if (target.classList.contains('screen')) {
            target.classList.add('active');
        }
    }

    // --- Core Logic ---
    async function handleStudentInfoSubmit(e) {
        e.preventDefault();
        const formData = new FormData(forms.studentInfo);
        studentInfo = Object.fromEntries(formData.entries());
        
        showScreen('loading');
        // Simulate slight delay for UX
        setTimeout(() => {
            showScreen('assessment');
            updateProgressBar();
            renderQuestion();
            elements.progressBar.classList.remove('hidden');
        }, 800);
    }

    function renderQuestion() {
        const question = assessmentData.questionBank[currentQuestionIndex];
        if (!question) return;

        let html = `
            <div class="question-card">
                <div class="question-header">
                    <span class="section-badge">${question.section}</span>
                    <span class="question-type">${question.questionType}</span>
                </div>
                <h2 class="question-text">${question.question}</h2>
                <div class="options-container">
        `;

        // Handle different question types
        if (question.questionType === 'Likert Scale' || question.questionType === 'Multiple Choice' || question.questionType === 'Ethics' || question.questionType === 'School-life Scenario' || question.questionType === 'Situational Judgement') {
            question.options.forEach((option, idx) => {
                const isChecked = userResponses[currentQuestionIndex]?.answer === option? 'checked' : '';
                html += `
                    <label class="option-label">
                        <input type="radio" name="q${currentQuestionIndex}" value="${option}" ${isChecked} required>
                        <span class="option-text">${option}</span>
                    </label>
                `;
            });
        } else if (question.questionType === 'Forced Choice') {
            question.options.forEach((option, idx) => {
                const isChecked = userResponses[currentQuestionIndex]?.answer === option? 'checked' : '';
                html += `
                    <label class="option-label">
                        <input type="radio" name="q${currentQuestionIndex}" value="${option}" ${isChecked} required>
                        <span class="option-text">${option}</span>
                    </label>
                `;
            });
        } else if (question.questionType === 'Ranking') {
            // For simplicity in this implementation, we use checkboxes to pick order/selection
            // Real implementation would use a drag-drop library
            question.options.forEach((option) => {
                html += `
                    <label class="option-label">
                        <input type="checkbox" name="q${currentQuestionIndex}" value="${option}">
                        <span class="option-text">${option}</span>
                    </label>
                `;
            });
        } else if (question.questionType === 'Reflection' || question.questionType === 'Innovation') {
            html += `
                <textarea name="q${currentQuestionIndex}" required placeholder="Type your response here..." rows="5">${userResponses[currentQuestionIndex]?.answer || ''}</textarea>
            `;
        }

        html += `</div></div>`;
        elements.questionsContainer.innerHTML = html;

        // Update buttons
        elements.prevBtn.disabled = currentQuestionIndex === 0;
        elements.nextBtn.classList.toggle('hidden', currentQuestionIndex === assessmentData.questionBank.length - 1);
        elements.submitBtn.classList.toggle('hidden', currentQuestionIndex!== assessmentData.questionBank.length - 1);
        
        updateProgressBar();
    }

    function updateProgressBar() {
        const total = assessmentData.questionBank.length;
        const current = currentQuestionIndex + 1;
        elements.progressText.textContent = `Question ${current} of ${total}`;
        const percent = (current / total) * 100;
        elements.progressFill.style.width = `${percent}%`;
    }

    function handleNext() {
        saveCurrentAnswer();
        if (currentQuestionIndex < assessmentData.questionBank.length - 1) {
            currentQuestionIndex++;
            renderQuestion();
        }
    }

    function handlePrev() {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            renderQuestion();
        }
    }

    function saveCurrentAnswer() {
        const question = assessmentData.questionBank[currentQuestionIndex];
        const formData = new FormData(forms.assessment);
        let answer;

        if (question.questionType === 'Reflection' || question.questionType === 'Innovation') {
            answer = formData.get(`q${currentQuestionIndex}`);
        } else if (question.questionType === 'Ranking') {
            answer = formData.getAll(`q${currentQuestionIndex}`);
        } else {
            answer = formData.get(`q${currentQuestionIndex}`);
        }

        userResponses[currentQuestionIndex] = {
            questionId: question.id,
            section: question.section,
            question: question.question,
            answer: answer,
            competencies: question.hiddenCompetencies || []
        };
    }

    async function handleAssessmentSubmit(e) {
        e.preventDefault();
        
        // Validate current question if it's the last one
        saveCurrentAnswer();

        showScreen('loading');

        // Simulate processing/scoring delay
        setTimeout(() => {
            displayResults();
            showScreen('results');
        }, 1500);
    }

    function displayResults() {
        // Extract unique competencies from user responses
        const competencyScores = {};
        userResponses.forEach(resp => {
            if (resp.competencies) {
                resp.competencies.forEach(comp => {
                    competencyScores[comp] = (competencyScores[comp] || 0) + 1;
                });
            }
        });

        // Sort competencies by score
        const sortedCompetencies = Object.entries(competencyScores)
            sort(([, a], [, b]) => b - a);

        let summaryHtml = `
            <div class="result-card">
                <p>Thank you, <strong>${studentInfo.fullName}</strong>!</p>
                <p>Based on your responses, here are your dominant competency areas:</p>
                <ul class="competency-list">
        `;

        if (sortedCompetencies.length === 0) {
            summaryHtml += `<li>Incomplete data</li>`;
        } else {
            sortedCompetencies.slice(0, 5).forEach(([comp, score]) => {
                summaryHtml += `<li><strong>${comp}</strong> (Signal strength: ${score})</li>`;
            });
        }

        summaryHtml += `</ul></div>`;
        elements.resultsSummary.innerHTML = summaryHtml;
    }

    function downloadResults() {
        const results = {
            student: studentInfo,
            timestamp: new Date().toISOString(),
            responses: userResponses
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(results, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `CareerDNA_Results_${studentInfo.fullName.replace(/\s+/g, '_')}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    function restartAssessment() {
        currentQuestionIndex = 0;
        userResponses.length = 0;
        studentInfo = {};
        forms.studentInfo.reset();
        forms.assessment.reset();
        showScreen('welcome');
    }

    // --- App Start ---
    init();
});
</script>
```</write_to_file>