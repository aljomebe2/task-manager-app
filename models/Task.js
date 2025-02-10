import fs from 'fs';

const FILE_PATH = './assets/tasks.json';

// Get tasks from the JSON file
export function getTasks() {
    try {
        const data = fs.readFileSync(FILE_PATH, 'utf8');
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error reading tasks:', error);
        return [];
    }
}

// Save tasks to the JSON file
export function saveTasks(tasks) {
    try {
        fs.writeFileSync(FILE_PATH, JSON.stringify(tasks, null, 4), 'utf8');
    } catch (error) {
        console.error('Error saving tasks:', error);
    }
}

// Add a task
export function addTask(task) {
    const tasks = getTasks();
    tasks.push({
        id: tasks.length + 1,
        created_at: new Date(),
        priority: task.priority || "none", 
        ...task
    });
    saveTasks(tasks);
}

// Update a task
export function updateTask(id, updates) {
    const tasks = getTasks();
    const taskIndex = tasks.findIndex(task => task.id === id);
    if (taskIndex !== -1) {
        tasks[taskIndex] = { ...tasks[taskIndex], ...updates };
        saveTasks(tasks);
    }
}

// Delete a task
export function deleteTask(id) {
    const tasks = getTasks();
    const taskIndex = tasks.findIndex(task => task.id === id);
    if (taskIndex !== -1) {
        tasks.splice(taskIndex, 1);
        saveTasks(tasks);
        return { success: true };
    }
    return { success: false };
}
