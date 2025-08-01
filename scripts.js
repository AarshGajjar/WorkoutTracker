
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const dom = {
        phaseSelector: document.querySelector('.phase-selector'),
        daySelector: document.getElementById('daySelector'),
        workoutContainer: document.getElementById('workoutContainer'),
        completionScreen: document.getElementById('completionScreen'),
        backBtn: document.getElementById('backBtn'),
        restartBtn: document.getElementById('restartBtn'),
        workoutTitle: document.getElementById('workoutTitle'),
        exerciseList: document.getElementById('exerciseList'),
        exerciseCircle: document.getElementById('exerciseCircle'),
        progressRing: document.getElementById('progressRing'),
        circuitCounter: document.getElementById('circuitCounter'),
        circuitSlider: document.getElementById('circuitSlider'),
        circuitValue: document.getElementById('circuitValue'),
        summaryContainer: document.getElementById('summaryContainer'),
        soundCue: document.getElementById('soundCue'),
    };

    // --- State Management ---
    const state = {
        workouts: {},
        currentWorkout: null,
        currentExerciseIndex: 0,
        currentSet: 1,
        currentCircuit: 1,
        totalCircuits: 3,
        selectedWeek: 'Week 1-2',
        workoutStartTime: 0,
        timerInterval: null,
        onTimerComplete: null,
        isResting: false,
        workoutStarted: false,
    };

    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzxw7VLsNMZX58JC6KKgwasAPfnCcYDx-jBt_wUu2y_Yrk1tyTyHYulpr25MzqhUZYz/exec';
    const REST_PERIOD_S = 15;
    const RING_CIRCUMFERENCE = 2 * Math.PI * 178;

    // --- Data Loading ---
    async function loadWorkouts() {
        const originalButtonsHTML = dom.daySelector.innerHTML;
        showLoadingMessage('Loading workouts...');
        try {
            const response = await fetch(APPS_SCRIPT_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const rawExercises = await response.json();
            state.workouts = parseRawExercises(rawExercises);
            dom.daySelector.innerHTML = originalButtonsHTML;
            addDayButtonListeners();
        } catch (error) {
            console.error("Failed to load workouts:", error);
            showErrorMessage();
        }
    }

    function parseRawExercises(rawExercises) {
        const newWorkouts = {};
        const dayNameToKey = { "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6 };
        rawExercises.forEach(ex => {
            const week = ex.week;
            const dayKey = dayNameToKey[ex.day] || ex.day;
            if (!week || !dayKey) return;
            if (!newWorkouts[week]) newWorkouts[week] = {};
            if (!newWorkouts[week][dayKey]) {
                newWorkouts[week][dayKey] = { title: ex['day name'], exercises: [] };
            }
            newWorkouts[week][dayKey].exercises.push({
                type: ex['exercise type'],
                name: ex['exercise name'],
                details: ex['reps/time'],
                sets: parseInt(ex.sets, 10) || 1,
            });
        });
        return newWorkouts;
    }

    // --- Workout Flow ---
    function startWorkout(dayKey) {
        if (!state.workouts[state.selectedWeek] || !state.workouts[state.selectedWeek][dayKey]) {
            showLoadingMessage('Workout for the selected phase is not available.');
            return;
        }
        state.currentWorkout = state.workouts[state.selectedWeek][dayKey];
        state.currentExerciseIndex = 0;
        state.currentSet = 1;
        state.currentCircuit = 1;
        state.isResting = false;
        state.workoutStarted = false;
        showScreen('workout');
        createExerciseList();
        updateCircuitCounter();
        updateWorkoutDisplay();
    }

    function beginFirstExercise() {
        state.workoutStarted = true;
        state.workoutStartTime = Date.now();
        updateWorkoutDisplay();
    }

    function advanceWorkout() {
        const exercise = state.currentWorkout.exercises[state.currentExerciseIndex];
        if (state.currentSet < exercise.sets) {
            state.currentSet++;
            startRest(REST_PERIOD_S);
        } else {
            state.currentSet = 1;
            state.currentExerciseIndex++;
            const exercises = state.currentWorkout.exercises;
            const mainCircuitStart = exercises.findIndex(ex => ex.type.toLowerCase() === 'main');
            const mainCircuitEnd = findLastIndex(exercises, ex => ex.type.toLowerCase() === 'main');
            if (state.currentExerciseIndex > mainCircuitEnd && state.currentCircuit < state.totalCircuits && mainCircuitStart !== -1) {
                state.currentCircuit++;
                state.currentExerciseIndex = mainCircuitStart;
                startRest(REST_PERIOD_S * 2);
            } else if (state.currentExerciseIndex >= exercises.length) {
                finishWorkout();
            } else {
                startRest(REST_PERIOD_S);
            }
        }
    }

    function startRest(duration) {
        state.isResting = true;
        updateWorkoutDisplay();
        startTimer(duration, () => {
            state.isResting = false;
            updateWorkoutDisplay();
        });
    }

    function finishWorkout() {
        const durationMs = Date.now() - state.workoutStartTime;
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.round((durationMs % 60000) / 1000);
        dom.summaryContainer.innerHTML = `
            Well done, Aarsh.<br>
            Total workout time: <strong>${minutes}m ${seconds}s</strong>.
        `;
        showScreen('completion');
        playSound();
    }

    function goBack() {
        if (state.timerInterval) clearInterval(state.timerInterval);
        showScreen('daySelector');
        state.currentWorkout = null;
        state.workoutStarted = false;
    }

    // --- UI Updates ---
    function updateWorkoutDisplay() {
        if (!state.currentWorkout) return;
        const exercise = state.currentWorkout.exercises[state.currentExerciseIndex];
        if (!exercise) {
            console.error("Invalid exercise index.");
            goBack();
            return;
        }
        dom.workoutTitle.textContent = state.currentWorkout.title;
        updateProgressRing();
        updateExerciseList();
        if (!state.workoutStarted) {
            renderStartView(exercise);
            return;
        }
        if (state.isResting) {
            renderRestingView();
            return;
        }
        const time = parseTimeFromDetails(exercise.details);
        if (time > 0) {
            renderTimedExerciseView(exercise, time);
            startTimer(time, advanceWorkout);
        } else {
            renderRepBasedExerciseView(exercise);
        }
    }

    function renderStartView(exercise) {
        dom.exerciseCircle.innerHTML = `
            <div class="exercise-type">${exercise.type}</div>
            <div class="exercise-name">${exercise.name}</div>
            <div class="exercise-details">${exercise.details}</div>
            <button id="actionBtn" class="action-btn">Start Workout</button>
        `;
        document.getElementById('actionBtn').addEventListener('click', beginFirstExercise);
    }

    function renderRepBasedExerciseView(exercise) {
        dom.exerciseCircle.innerHTML = `
            <div class="exercise-type">${exercise.type}</div>
            <div class="exercise-name">${exercise.name}</div>
            <div class="exercise-details">${exercise.details}</div>
            ${exercise.sets > 1 ? `<div class="exercise-sets">Set ${state.currentSet} of ${exercise.sets}</div>` : ''}
            <button id="actionBtn" class="action-btn">Complete Set</button>
        `;
        document.getElementById('actionBtn').addEventListener('click', advanceWorkout);
    }

    function renderTimedExerciseView(exercise, time) {
        dom.exerciseCircle.innerHTML = `
            <div class="exercise-type">${exercise.type}</div>
            <div class="exercise-name">${exercise.name}</div>
            <div class="timer-display" id="timerDisplay">${time}</div>
            ${exercise.sets > 1 ? `<div class="exercise-sets">Set ${state.currentSet} of ${exercise.sets}</div>` : ''}
            <button id="skipBtn" class="action-btn">Skip</button>
        `;
        document.getElementById('skipBtn').addEventListener('click', skipTimer);
    }

    function renderRestingView() {
        const nextExercise = state.currentWorkout.exercises[state.currentExerciseIndex];
        dom.exerciseCircle.innerHTML = `
            <div class="exercise-type">Up Next: ${nextExercise ? nextExercise.name : 'Finish'}</div>
            <div class="exercise-name">REST</div>
            <div class="timer-display" id="timerDisplay">...</div>
            <button id="skipBtn" class="action-btn">Skip</button>
        `;
        document.getElementById('skipBtn').addEventListener('click', skipTimer);
    }

    function createExerciseList() {
        dom.exerciseList.innerHTML = state.currentWorkout.exercises.map((ex, i) => `
            <div class="exercise-item" data-index="${i}">
                <div class="exercise-item-name">${ex.name}</div>
                <div class="exercise-item-details">${ex.details}</div>
            </div>
        `).join('');
    }

    function updateExerciseList() {
        const items = dom.exerciseList.querySelectorAll('.exercise-item');
        items.forEach((item, index) => {
            item.className = 'exercise-item';
            if (index === state.currentExerciseIndex) {
                item.classList.add('current');
                const list = dom.exerciseList;
                const itemLeft = item.offsetLeft;
                const listWidth = list.clientWidth;
                const itemWidth = item.clientWidth;
                list.scrollLeft = itemLeft - (listWidth - itemWidth) / 2;
            } else if (index < state.currentExerciseIndex) {
                item.classList.add('completed');
            }
        });
    }

    function updateProgressRing() {
        if (!state.workoutStarted) {
            dom.progressRing.style.strokeDashoffset = RING_CIRCUMFERENCE;
            return;
        }
        const progress = (state.currentExerciseIndex + (state.currentSet - 1) / (state.currentWorkout.exercises[state.currentExerciseIndex]?.sets || 1)) / state.currentWorkout.exercises.length;
        const offset = RING_CIRCUMFERENCE - (progress * RING_CIRCUMFERENCE);
        dom.progressRing.style.strokeDashoffset = `${offset}`;
    }

    function updateCircuitCounter() {
        dom.circuitCounter.innerHTML = '';
        for (let i = 1; i <= state.totalCircuits; i++) {
            const dot = document.createElement('div');
            dot.className = `circuit-dot ${i < state.currentCircuit ? 'completed' : ''}`;
            dom.circuitCounter.appendChild(dot);
        }
    }

    function showScreen(screenName) {
        dom.phaseSelector.style.display = (screenName === 'daySelector') ? 'flex' : 'none';
        dom.daySelector.style.display = (screenName === 'daySelector') ? 'flex' : 'none';
        dom.workoutContainer.style.display = (screenName === 'workout') ? 'flex' : 'none';
        dom.completionScreen.style.display = (screenName === 'completion') ? 'flex' : 'none';
    }

    function showLoadingMessage(message) {
        dom.daySelector.innerHTML = `<div style="text-align: center; padding: 20px; font-size: 16px;">${message}</div>`;
    }

    function showErrorMessage() {
        dom.daySelector.innerHTML = `<div style="text-align: center; padding: 20px; color: #ff6b6b;">
            <strong>Failed to load workouts.</strong><br><br>
            Please check the Google Sheet link and format.
        </div>`;
    }

    // --- Timers & Helpers ---
    function startTimer(duration, onComplete) {
        if (state.timerInterval) clearInterval(state.timerInterval);
        state.onTimerComplete = onComplete;
        let timeLeft = duration;
        const timerDisplay = document.getElementById('timerDisplay');
        if (timerDisplay) timerDisplay.textContent = timeLeft;

        state.timerInterval = setInterval(() => {
            timeLeft--;
            if (timerDisplay) timerDisplay.textContent = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(state.timerInterval);
                playSound();
                if (state.onTimerComplete) state.onTimerComplete();
            }
        }, 1000);
    }

    function skipTimer() {
        if (state.timerInterval) clearInterval(state.timerInterval);
        playSound();
        if (state.onTimerComplete) state.onTimerComplete();
    }

    function parseTimeFromDetails(details) {
        const match = details.match(/(\d+)\s*s/);
        return match ? parseInt(match[1], 10) : 0;
    }

    function playSound() {
        dom.soundCue.currentTime = 0;
        dom.soundCue.play().catch(e => console.log("Playback prevented."));
    }

    function findLastIndex(array, predicate) {
        for (let i = array.length - 1; i >= 0; i--) {
            if (predicate(array[i])) return i;
        }
        return -1;
    }

    // --- Event Listeners ---
    function addDayButtonListeners() {
        const dayButtons = dom.daySelector.querySelectorAll('.day-btn');
        dayButtons.forEach(btn => {
            btn.addEventListener('click', () => startWorkout(btn.dataset.day));
        });
    }

    dom.phaseSelector.addEventListener('click', (e) => {
        if (e.target.classList.contains('phase-btn')) {
            document.querySelectorAll('.phase-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            state.selectedWeek = e.target.dataset.week;
        }
    });

    dom.circuitSlider.addEventListener('input', (e) => {
        state.totalCircuits = parseInt(e.target.value, 10);
        dom.circuitValue.textContent = state.totalCircuits;
        if (state.currentWorkout) updateCircuitCounter();
    });

    dom.backBtn.addEventListener('click', goBack);
    dom.restartBtn.addEventListener('click', goBack);

    // --- Initial Load ---
    dom.progressRing.style.strokeDasharray = RING_CIRCUMFERENCE;
    dom.progressRing.style.strokeDashoffset = RING_CIRCUMFERENCE;
    loadWorkouts();
});
