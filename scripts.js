const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzxw7VLsNMZX58JC6KKgwasAPfnCcYDx-jBt_wUu2y_Yrk1tyTyHYulpr25MzqhUZYz/exec';

let workouts = {};
let currentWorkout = null;
let currentExerciseIndex = 0;
let totalCircuits = 1;
let currentCircuit = 1;
let mainCircuitStart = 0;
let mainCircuitEnd = 0;
let selectedWeek = 'Week 1-2'; // Default to the first phase

const dayNameToKey = {
    "Monday": 1,
    "Tuesday": 2,
    "Wednesday": 3,
    "Thursday": 4,
    "Friday": 5,
    "Saturday": 6
};

async function loadWorkouts() {
    const daySelector = document.getElementById('daySelector');
    const originalButtonsHTML = daySelector.innerHTML;
    daySelector.innerHTML = '<div style="text-align: center; padding: 20px; font-size: 16px;">Loading workouts...</div>';

    try {
        const response = await fetch(APPS_SCRIPT_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const rawExercises = await response.json();

        const newWorkouts = {};
        rawExercises.forEach(ex => {
            const week = ex.week;
            // The Google Sheet might return the day name or number. Handle both.
            const dayKey = dayNameToKey[ex.day] || ex.day;
            if (!week || !dayKey) return;

            if (!newWorkouts[week]) {
                newWorkouts[week] = {};
            }
            if (!newWorkouts[week][dayKey]) {
                newWorkouts[week][dayKey] = {
                    title: ex['day name'],
                    exercises: []
                };
            }
            newWorkouts[week][dayKey].exercises.push({
                type: ex['exercise type'],
                name: ex['exercise name'],
                details: ex['reps/time']
            });
        });

        workouts = newWorkouts;
        daySelector.innerHTML = originalButtonsHTML; // Restore buttons

    } catch (error) {
        console.error("Failed to load workouts:", error);
        daySelector.innerHTML = `<div style="text-align: center; padding: 20px; color: #ff6b6b;">
            <strong>Failed to load workouts from Google Sheet.</strong><br><br>
            Please check the following:
            <ul style="text-align: left; display: inline-block; margin-top: 10px; font-size: 13px;">
                <li>Ensure your Google Sheet has the columns: <code>Week</code>, <code>Day</code>, <code>Day Name</code>, <code>Exercise Type</code>, <code>Exercise Name</code>, <code>Reps/Time</code>.</li>
                <li>Verify the Apps Script is deployed correctly and can access the sheet.</li>
                <li>Check the browser's developer console for more specific errors.</li>
            </ul>
        </div>`;
    }
}

function startWorkout(dayKey) {
    if (!workouts[selectedWeek] || !workouts[selectedWeek][dayKey]) {
        console.error(`Workout for phase ${selectedWeek}, day ${dayKey} not loaded.`);
        const daySelector = document.getElementById('daySelector');
        daySelector.innerHTML = `<div style="text-align: center; padding: 20px; color: #ff6b6b;">Workout for the selected phase is not available.</div>`;
        return;
    }

    currentWorkout = workouts[selectedWeek][dayKey];
    currentExerciseIndex = 0;
    currentCircuit = 1;

    document.querySelector('.week-selector-container').style.display = 'none';
    document.getElementById('daySelector').style.display = 'none';
    document.getElementById('completionScreen').style.display = 'none';
    document.getElementById('workoutContainer').style.display = 'flex';

    const exercises = currentWorkout.exercises;
    mainCircuitStart = exercises.findIndex(ex => ex.type.toLowerCase() === 'main');
    mainCircuitEnd = -1;
    for (let i = exercises.length - 1; i >= 0; i--) {
        if (exercises[i].type.toLowerCase() === 'main') {
            mainCircuitEnd = i;
            break;
        }
    }
     if (mainCircuitStart === -1) { // If no main circuit, treat all as one sequence
        mainCircuitStart = 0;
        mainCircuitEnd = exercises.length -1;
    }


    updateWorkoutDisplay();
    createExerciseList();
    updateCircuitCounter();
}

function completeExercise(e) {
    if (e) e.preventDefault();
    const exercises = currentWorkout.exercises;
    currentExerciseIndex++;

    // If we finished the main circuit and more rounds are left
    if (currentExerciseIndex > mainCircuitEnd && currentCircuit < totalCircuits && mainCircuitStart !== -1) {
        currentCircuit++;
        currentExerciseIndex = mainCircuitStart; // Go back to the start of the main circuit
    } else if (currentExerciseIndex >= exercises.length) {
        // Workout is fully complete
        document.getElementById('workoutContainer').style.display = 'none';
        document.getElementById('completionScreen').style.display = 'flex';
    }
    
    updateCircuitCounter();
    updateWorkoutDisplay();
}

function goBack() {
    document.querySelector('.week-selector-container').style.display = 'block';
    document.getElementById('daySelector').style.display = 'flex';
    document.getElementById('workoutContainer').style.display = 'none';
    document.getElementById('completionScreen').style.display = 'none';

    currentWorkout = null;
    currentExerciseIndex = 0;
    currentCircuit = 1;
    document.getElementById('circuitSlider').value = 1;
    document.getElementById('circuitValue').textContent = 1;
    totalCircuits = 1;
}

function updateWorkoutDisplay() {
    if (!currentWorkout || !currentWorkout.exercises[currentExerciseIndex]) {
        console.error("Workout or exercise is not available.");
        goBack();
        return;
    }
    const workout = currentWorkout;
    const exercise = workout.exercises[currentExerciseIndex];
    document.getElementById('workoutTitle').textContent = workout.title;

    const circumference = 2 * Math.PI * 178;
    const progressRing = document.getElementById('progressRing');
    progressRing.style.strokeDasharray = `${circumference}`;
    
    const progress = currentExerciseIndex / workout.exercises.length;
    const offset = circumference - (progress * circumference);
    progressRing.style.strokeDashoffset = `${offset}`;

    const exerciseCircle = document.getElementById('exerciseCircle');
    exerciseCircle.innerHTML = `
        <div class="exercise-type">${exercise.type}</div>
        <div class="exercise-name">${exercise.name}</div>
        <div class="exercise-details">${exercise.details}</div>
        <button class="complete-btn" onclick="completeExercise(event)">
            ${currentExerciseIndex === workout.exercises.length - 1 && currentCircuit === totalCircuits ? 'Finish' : 'Complete'}
        </button>
    `;
    updateExerciseList();
}

function createExerciseList() {
    const exerciseList = document.getElementById('exerciseList');
    const exercises = currentWorkout.exercises;
    exerciseList.innerHTML = exercises.map((exercise, index) => `
        <div class="exercise-item ${index === currentExerciseIndex ? 'current' : ''} ${index < currentExerciseIndex ? 'completed' : ''}">
            <div class="exercise-item-name">${exercise.name}</div>
            <div class="exercise-item-details">${exercise.details}</div>
        </div>
    `).join('');
}

function updateExerciseList() {
    const items = document.querySelectorAll('.exercise-item');
    items.forEach((item, index) => {
        item.className = 'exercise-item';
        if (index === currentExerciseIndex) {
            item.classList.add('current');
            const list = document.querySelector('.exercise-list');
            const itemLeft = item.offsetLeft;
            const listWidth = list.clientWidth;
            const itemWidth = item.clientWidth;
            list.scrollLeft = itemLeft - (listWidth - itemWidth) / 2;
        } else if (index < currentExerciseIndex) {
            item.classList.add('completed');
        }
    });
}

function updateCircuitCounter() {
    const counter = document.getElementById('circuitCounter');
    counter.innerHTML = '';
    for (let i = 1; i <= totalCircuits; i++) {
        const dot = document.createElement('div');
        dot.className = `circuit-dot ${i < currentCircuit ? 'completed' : ''}`;
        counter.appendChild(dot);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const slider = document.getElementById('circuitSlider');
    const value = document.getElementById('circuitValue');
    const weekSelector = document.getElementById('weekSelector');

    slider.addEventListener('input', function() {
        totalCircuits = parseInt(this.value);
        value.textContent = totalCircuits;
        if (currentWorkout) {
            updateCircuitCounter();
        }
    });

    weekSelector.addEventListener('change', function() {
        selectedWeek = this.value;
    });

    loadWorkouts();
});
