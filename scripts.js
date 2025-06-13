const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwW6bE86skWyOT4VcW0BeKtAWe9iMh-CBrogL4FHq4pQ1o6SNpI1rdSRYq3E6FZQg9T/exec';

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
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
        });
        
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

        workouts = newWorkouts;
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
let currentEditingDayKey = null;

function startWorkout(dayKey) {
    selectedWorkoutDayKey = dayKey; // Store the selected day key
    
    // Enable all edit-related buttons
    [
        'editDayBtn',
        'addExerciseBtn',
        'saveDayWorkoutBtn',
        'cancelEditDayBtn'
    ].forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.disabled = false;
        }
    });

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
    document.getElementById('workoutContainer').style.display = 'flex';    const editButton = document.getElementById('editDayBtn');
    editButton.style.display = 'block';
    
    // Re-attach event listener when button becomes visible
    editButton.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Edit button clicked');
        editDay();
    });
    
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
    });    // New Edit Day View button listeners
    const editDayBtn = document.getElementById('editDayBtn');
    if (editDayBtn) {
        editDayBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Edit button clicked'); // Debug log
            editDay();
        });
    } else {
        console.error('Edit Day button not found in DOM');
    }
    
    document.getElementById('addExerciseBtn').addEventListener('click', addExerciseToEditForm);
    document.getElementById('saveDayWorkoutBtn').addEventListener('click', saveDayWorkout);
    document.getElementById('cancelEditDayBtn').addEventListener('click', cancelEditDay);

    loadWorkouts(); // Load workouts when the DOM is ready
});

function generateExerciseEditGroupHTML(exercise, index) {
    const exerciseType = exercise ? exercise.type : '';
    const exerciseName = exercise ? exercise.name : '';
    const exerciseDetails = exercise ? exercise.details : '';
    // Consider adding a unique ID for each group if needed for more complex manipulations later
    return `
        <div class="exercise-edit-group" data-index="${index}">
            <button class="remove-exercise-btn" onclick="removeExerciseFromEditForm(this)">Remove</button>
            <label>Type:</label><input type="text" class="edit-type" value="${exerciseType}" placeholder="e.g., warmup, main, finisher">
            <label>Name:</label><input type="text" class="edit-name" value="${exerciseName}" placeholder="Exercise Name">
            <label>Details:</label><input type="text" class="edit-details" value="${exerciseDetails}" placeholder="e.g., 10 reps, 30s hold">
        </div>
    `;
}

function editDay() {
    console.log('editDay function called');
    console.log('selectedWorkoutDayKey:', selectedWorkoutDayKey);
    console.log('workouts:', workouts);
    
    if (!selectedWorkoutDayKey || !workouts[selectedWorkoutDayKey]) {
        console.error("No workout selected or workout data missing for key:", selectedWorkoutDayKey);
        alert("Error: Cannot edit day. No workout data loaded.");
        return;
    }
    currentEditingDayKey = selectedWorkoutDayKey;
    const workoutToEdit = workouts[currentEditingDayKey];

    document.getElementById('workoutContainer').style.display = 'none';
    document.getElementById('editDayView').style.display = 'flex'; // Show the edit day view

    document.getElementById('editDayTitle').textContent = `Edit Workout for ${workoutToEdit.title}`;

    const container = document.getElementById('editDayExerciseListContainer');
    container.innerHTML = ''; // Clear previous exercises
    workoutToEdit.exercises.forEach((exercise, index) => {
        container.innerHTML += generateExerciseEditGroupHTML(exercise, index);
    });
}

function addExerciseToEditForm() {
    const container = document.getElementById('editDayExerciseListContainer');
    const nextIndex = container.children.length; // Determine index for new exercise
    container.innerHTML += generateExerciseEditGroupHTML(null, nextIndex);
}

function removeExerciseFromEditForm(buttonElement) {
    buttonElement.parentElement.remove();
    // Note: Re-indexing data-index attributes is not strictly necessary if we read elements in order on save.
}

function cancelEditDay() {
    document.getElementById('editDayView').style.display = 'none';
    document.getElementById('workoutContainer').style.display = 'flex'; // Show the main workout view
    currentEditingDayKey = null;
}

async function saveDayWorkout() {
    if (!currentEditingDayKey) {
        console.error("No day is currently being edited.");
        alert("Error: No workout day selected for saving.");
        return;
    }

    const saveButton = document.getElementById('saveDayWorkoutBtn');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    const updatedExercises = [];
    const exerciseGroups = document.querySelectorAll('#editDayExerciseListContainer .exercise-edit-group');
    exerciseGroups.forEach(group => {
        const type = group.querySelector('.edit-type').value.trim();
        const name = group.querySelector('.edit-name').value.trim();
        const details = group.querySelector('.edit-details').value.trim();
        if (name) {
            updatedExercises.push({ type, name, details });
        }
    });

    const payload = {
        action: 'updateDayWorkout',
        day: currentEditingDayKey,
        exercises: updatedExercises
    };

    console.log("Saving day workout payload:", payload);    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errorMsg = `Error saving day workout. Status: ${response.status}`;
            try { const errorData = await response.json(); errorMsg += ` - ${errorData.message || 'Server error'}`; } catch(e){}
            throw new Error(errorMsg);
        }
        const result = await response.json();

        if (result.success) {
            // Update local data
            workouts[currentEditingDayKey].exercises = updatedExercises;
            // If the edited day is the currently active workout, update currentWorkout directly
            if (selectedWorkoutDayKey === currentEditingDayKey) {
                currentWorkout.exercises = [...updatedExercises]; // Ensure currentWorkout also reflects changes
            }

            alert('Workout for the day saved successfully!');
            document.getElementById('editDayView').style.display = 'none';
            // Important: Re-initialize the workout view for the *potentially* changed current day
            // This ensures that if we were editing the day we were viewing, it refreshes.
            // startWorkout will also handle showing workoutContainer and hiding others.
            startWorkout(currentEditingDayKey);

            // currentEditingDayKey = null; // Reset after successful save and view switch
        } else {
            throw new Error(result.message || "Save was not successful on the server.");
        }
    } catch (error) {
        console.error("Failed to save day workout:", error);
        alert(`Failed to save changes: ${error.message}\n\nPlease check:
- Your internet connection.
- The APPS_SCRIPT_URL in index.html (is it correct and re-deployed if script changed?).
- The Google Sheet "Workout Plan" (sheet "Exercises", columns: day,type,name,details).
- Apps Script deployment: "Execute as: Me", "Who has access: Anyone". (Crucial for CORS and doOptions).
- Browser developer console (Network/Console tabs) for detailed errors.
- Apps Script project's execution logs for server-side errors.

Your changes have not been saved. Please try again.`);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save All Changes';
    }
}



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
    // Reset all edit-related buttons
    [
        'editDayBtn',
        'addExerciseBtn',
        'saveDayWorkoutBtn',
        'cancelEditDayBtn'
    ].forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.disabled = false;
        }
    });
    
    document.getElementById('editDayView').style.display = 'none';
    document.getElementById('editDayBtn').style.display = 'none';

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
