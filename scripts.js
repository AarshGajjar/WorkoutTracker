const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzxw7VLsNMZX58JC6KKgwasAPfnCcYDx-jBt_wUu2y_Yrk1tyTyHYulpr25MzqhUZYz/exec';

let workouts = {}
const WORKOUT_TITLES = {
    1: "Pull/Push Power + Upper Skills",
    2: "Strength + Lower Skills + Core",
    3: "Hybrid + Advanced Skills + Arms"
};

async function loadWorkouts() {
    const daySelector = document.getElementById('daySelector');
    const originalButtonsHTML = daySelector.innerHTML; // Save original buttons
    daySelector.innerHTML = '<div style="text-align: center; padding: 20px; font-size: 16px;">Loading workouts...</div>';
    const dayButtons = document.querySelectorAll('.day-btn');
    dayButtons.forEach(btn => btn.disabled = true);

     try {
        const response = await fetch(APPS_SCRIPT_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const rawExercises = await response.json();

        const newWorkouts = {};
        rawExercises.forEach(ex => {
            if (!newWorkouts[ex.day]) {
                newWorkouts[ex.day] = {
                    title: WORKOUT_TITLES[ex.day] || `Workout Day ${ex.day}`, // Assign title
                    exercises: []
                };
            }
            newWorkouts[ex.day].exercises.push({type: ex.type, name: ex.name, details: ex.details});
        });

                workouts = newWorkouts
        daySelector.innerHTML = originalButtonsHTML;


    } catch (error) {
        console.error("Failed to load workouts:", error);
        daySelector.innerHTML = `<div style="text-align: center; padding: 20px; color: #ff6b6b;">
            <strong>Failed to load workouts.</strong><br><br>
            Please check the following:
            <ul style="text-align: left; display: inline-block; margin-top: 10px; font-size: 13px;">
                <li>Is the APPS_SCRIPT_URL in index.html correct and updated after any Apps Script re-deployment?</li>
                <li>Is the Google Sheet named "Workout Plan" with a sheet/tab named "Exercises" (columns: day, type, name, details) correctly set up and shared if necessary (though script runs as owner)?</li>
                <li>Was the Apps Script deployed (or re-deployed) as a Web App with "Execute as: Me" and "Who has access: Anyone"? (This is vital for CORS and doOptions to work).</li>
                <li>Check your browser's developer console (Network tab and Console tab) for more specific error messages.</li>
                <li>Check the Apps Script project's execution logs for any server-side errors.</li>
            </ul>
            <br>Try refreshing the page. If issues persist, verify the Apps Script deployment.
        </div>`;
    }
}



let currentWorkout = null;
let currentExerciseIndex = 0;
let totalCircuits = 1;
let currentCircuit = 1;
let mainCircuitStart = 0;
let mainCircuitEnd = 0;
let selectedWorkoutDayKey = null;

function startWorkout(dayKey) {
    selectedWorkoutDayKey = dayKey; // Store the selected day key

    if (!workouts[dayKey]) {
        console.error(`Workout for day ${dayKey} not loaded or does not exist.`);
        const daySelector = document.getElementById('daySelector');
        daySelector.innerHTML = `<div style="text-align: center; padding: 20px; color: #ff6b6b;">Workout Day ${dayKey} is not available. Please try again later.</div>`;
        document.getElementById('workoutContainer').style.display = 'none';
        document.getElementById('completionScreen').style.display = 'none';
        document.getElementById('editDayView').style.display = 'none';
        return;
    }
    currentWorkout = workouts[dayKey]; // currentWorkout is now correctly assigned
    currentExerciseIndex = 0;
    currentCircuit = 1;
    document.getElementById('daySelector').style.display = 'none';
    document.getElementById('editDayView').style.display = 'none';
    document.getElementById('completionScreen').style.display = 'none';
    document.getElementById('workoutContainer').style.display = 'flex';
    // Find main circuit boundaries
    const exercises = currentWorkout.exercises;
    mainCircuitStart = exercises.findIndex(ex => ex.type === 'main');
    for (let i = exercises.length - 1; i >= 0; i--) {
        if (exercises[i].type === 'main') {
            mainCircuitEnd = i;
            break;
        }
    }
    
    updateWorkoutDisplay();
    createExerciseList();
    updateCircuitCounter();
}

function updateCircuitCounter() {
    const counter = document.getElementById('circuitCounter');
    counter.innerHTML = '';
    for (let i = 1; i <= totalCircuits; i++) {
        const dot = document.createElement('div');
        dot.className = `circuit-dot ${i <= currentCircuit - 1 ? 'completed' : ''}`;
        counter.appendChild(dot);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const slider = document.getElementById('circuitSlider');
    const value = document.getElementById('circuitValue');
    
    slider.addEventListener('input', function() {
        totalCircuits = parseInt(this.value);
        value.textContent = totalCircuits;
        if (currentWorkout) {
            updateCircuitCounter();
        }
    });
    loadWorkouts(); // Load workouts when the DOM is ready
});

function completeExercise(e) {
    if (e) e.preventDefault();
    const exercises = currentWorkout.exercises;
    currentExerciseIndex++;

    // If we're at the end of the main circuit
    if (currentExerciseIndex > mainCircuitEnd && currentCircuit < totalCircuits) {
        currentCircuit++;
        currentExerciseIndex = mainCircuitStart; // Go back to start of main circuit
        updateCircuitCounter();
        updateWorkoutDisplay();
    }
    // If we're at the end of all circuits or not in a circuit
    else if (currentExerciseIndex >= exercises.length) {
        document.getElementById('workoutContainer').style.display = 'none';
        document.getElementById('completionScreen').style.display = 'flex';
    } else {
        updateWorkoutDisplay();
    }
}

function goBack() {
    document.getElementById('editDayView').style.display = 'none';

    if (Object.keys(workouts).length > 0) {
        document.getElementById('daySelector').style.display = 'flex';
    } else {
        // Error message is in daySelector if load failed
    }
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
    const workout = currentWorkout;
    const exercise = workout.exercises[currentExerciseIndex];
    document.getElementById('workoutTitle').textContent = workout.title;
    const progress = (currentExerciseIndex / workout.exercises.length) * 100;
    const circumference = 2 * Math.PI * 148;
    const progressRing = document.getElementById('progressRing');
    progressRing.style.strokeDasharray = circumference;
    progressRing.style.strokeDashoffset = (1 - progress / 100) * circumference;
    const exerciseCircle = document.getElementById('exerciseCircle');
    exerciseCircle.innerHTML = `
        <div class="exercise-type">${exercise.type}</div>
        <div class="exercise-name">${exercise.name}</div>
        <div class="exercise-details">${exercise.details}</div>
        <button class="complete-btn" onclick="completeExercise(event)">
            ${currentExerciseIndex === workout.exercises.length - 1 ? 'Finish' : 'Complete'}
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
