import express from 'express';
import { engine } from 'express-handlebars';
import session from 'express-session';
import flash from 'connect-flash';
import bcrypt from 'bcrypt';
import methodOverride from 'method-override';
import { getTasks, addTask, updateTask, deleteTask } from './models/Task.js';
import { addUser, findUserByEmail } from './models/User.js';

const PORT = process.env.PORT || 3000
const server = express()

// Registration of Handlebars helpers (with partialsDir)
server.engine('handlebars', engine({
  partialsDir: './views/partials',
  helpers: {
    eq: (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase(),
    lt: (a, b) => new Date(a) < new Date(b)
  }
}));

// Views and public files definition
server.set('view engine', 'handlebars');
server.set('views', './views');
server.use(express.static('public'));

// Middleware to parse request bodies
server.use(express.urlencoded({ extended: true }));
server.use(express.json());

// Authentication middleware
const ensureAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    req.flash('error_msg', 'Please log in first.');
    return res.redirect('/login');
  }
  next();
};

// Method Override for handling PUT and DELETE requests
server.use(methodOverride((req, res) => {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    const method = req.body._method;
    delete req.body._method;
    return method;
  }
}));

// Session management
server.use(session({
  secret: 'yourSecretKey',
  resave: false,
  saveUninitialized: false,
}));

// Initialize Connect-Flash
server.use(flash());

// Setting local variables for templates
server.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.user = req.session.user;
  next();
});

// Registration route
server.get('/register', (req, res) => {
  res.render('register');
});

// Render registration form
server.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    req.flash('error_msg', 'Please fill in all fields.');
    return res.redirect('/register');
  }
  if (findUserByEmail(email)) {
    req.flash('error_msg', 'Email is already registered.');
    return res.redirect('/register');
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  addUser({ name, email, password: hashedPassword });
  req.flash('success_msg', 'Registration successful! You can now log in.');
  res.redirect('/login');
});

// Login route
server.get('/login', (req, res) => {
  res.render('login');
});

// Render login form
server.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = findUserByEmail(email);
  if (!user) {
    req.flash('error_msg', 'Invalid credentials');
    return res.redirect('/login');
  }
  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    req.flash('error_msg', 'Invalid credentials');
    return res.redirect('/login');
  }
  req.session.user = { id: user.id, name: user.name, email: user.email };
  req.flash('success_msg', 'Login successful!');
  res.redirect('/');
});

// Logout route
server.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// Home Route with filtering options
server.get('/', ensureAuthenticated, (req, res) => {
  let tasks = getTasks().filter(task => task.userId === req.session.user.id);

  // Extract filtering and sorting query parameters with defaults
  const statusFilter = req.query.status || 'all';
  const priorityFilter = req.query.priority || 'all';
  const dueFilter = req.query.due || 'all';
  const specificDue = req.query.specificDue || '';
  const sort = req.query.sort || '';
  const searchQuery = req.query.search ? req.query.search.trim().toLowerCase() : '';
  const view = req.query.view || 'default';

  // Exclude cancelled tasks for default view
  if (view === 'default') {
    tasks = tasks.filter(task => task.status !== 'Cancelled');
  }

  // Status filtering
  if (statusFilter !== 'all') {
    tasks = tasks.filter(task => task.status.toLowerCase() === statusFilter.toLowerCase());
  }

  // Priority filtering
  if (priorityFilter !== 'all') {
    tasks = tasks.filter(task => {
      const taskPriority = task.priority ? task.priority.toLowerCase() : "";
      return taskPriority === priorityFilter.toLowerCase();
    });
  }

  // Due date filtering
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = today.toLocaleDateString('en-CA');
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString('en-CA');
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toLocaleDateString('en-CA');

  if (dueFilter !== 'all') {
    tasks = tasks.filter(task => {
      if (!task.dueDate) return false;
      const dueStr = new Date(task.dueDate).toLocaleDateString('en-CA');
      if (dueFilter === 'pastDue') return dueStr < todayStr;
      if (dueFilter === 'dueToday') return dueStr === todayStr;
      if (dueFilter === 'dueTomorrow') return dueStr === tomorrowStr;
      if (dueFilter === 'dueNextWeek') return dueStr > tomorrowStr && dueStr <= nextWeekStr;
      if (dueFilter === 'specific') return dueStr === specificDue;
      return true;
    });
  }

  // Search filtering
  if (searchQuery) {
    tasks = tasks.filter(task => task.name.toLowerCase().includes(searchQuery));
  }

  // Sorting
  if (sort === 'name') {
    tasks.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'status') {
    const statusOrder = {
      'pending': 1,
      'in progress': 2,
      'completed': 3,
      'cancelled': 4
    };
    tasks.sort((a, b) => {
      const sA = statusOrder[a.status.toLowerCase()] || 99;
      const sB = statusOrder[b.status.toLowerCase()] || 99;
      return sA - sB;
    });
  } else if (sort === 'dueDate') {
    tasks.sort((a, b) => {
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
  }
  res.render('home', { tasks, sort, statusFilter, priorityFilter, dueFilter, specificDue, search: req.query.search || '', view, today: todayStr });
});

// Render Add Task Form
server.get('/add-task', ensureAuthenticated, (req, res) => {
  res.render('add-task');
});

// Add Task Route
server.post('/add-task', ensureAuthenticated, (req, res) => {
  const { name, status, dueDate, completedDate, priority } = req.body;
  if (!name || !status) {
    req.flash('error_msg', 'Missing task details.');
    return res.redirect('/add-task');
  }
  const now = new Date();
  if (status !== 'Completed') {
    if (dueDate) {
      const due = new Date(dueDate);
      if (due.getTime() < now.getTime() + 60000) {
        req.flash('error_msg', 'Due date must be at least 1 minute after the current time.');
        return res.redirect('/add-task');
      }
    }
  } else {
    if (!completedDate) {
      req.flash('error_msg', 'Completed tasks must have a completion date.');
      return res.redirect('/add-task');
    }
  }
  addTask({ name, status, dueDate: dueDate || null, completedDate, priority, userId: req.session.user.id });
  req.flash('success_msg', 'Task added successfully!');
  res.redirect('/');
});

// Render Task Form
server.get('/edit-task/:id', ensureAuthenticated, (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const task = getTasks().find(t => parseInt(t.id, 10) === taskId);
  if (!task || Number(task.userId) !== Number(req.session.user.id)) {
    return res.status(404).send('Unauthorized or task not found');
  }
  res.render('add-task', { task });
});

// Update Task Route
server.post('/update-task/:id', ensureAuthenticated, (req, res) => {
  const { name, status, dueDate, completedDate, priority } = req.body;
  const taskId = parseInt(req.params.id, 10);
  const task = getTasks().find(t => parseInt(t.id, 10) === taskId);
  if (!task || Number(task.userId) !== Number(req.session.user.id)) {
    return res.status(404).send('Unauthorized or task not found');
  }
  const now = new Date();
  if (status !== 'Completed') {
    if (dueDate) {
      const due = new Date(dueDate);
      if (due.getTime() < now.getTime() + 60000) {
        req.flash('error_msg', 'Due date must be at least 1 minute after the current time.');
        return res.redirect(`/edit-task/${taskId}`);
      }
    }
  } else {
    if (!completedDate) {
      req.flash('error_msg', 'Completed tasks must have a completion date.');
      return res.redirect(`/edit-task/${taskId}`);
    }
  }
  updateTask(taskId, { name, status, dueDate: dueDate || null, completedDate, priority });
  req.flash('success_msg', 'Task updated successfully!');
  res.redirect('/');
});

// Update Task Status Route (AJAX for checkbox)
server.post('/update-status/:id', ensureAuthenticated, (req, res) => {
  const { status } = req.body;
  const taskId = parseInt(req.params.id, 10);
  const task = getTasks().find(t => parseInt(t.id, 10) === taskId);
  if (!task || Number(task.userId) !== Number(req.session.user.id)) {
    return res.status(404).json({ success: false, message: "Unauthorized or task not found" });
  }
  const now = new Date();
  if (status === "Completed") {
    updateTask(taskId, { status: "Completed", completedDate: now.toISOString() });
    return res.json({ success: true, message: "Task marked as Completed", completedDate: now.toISOString() });
  } else {
    updateTask(taskId, { status: "Pending", completedDate: null });
    return res.json({ success: true, message: "Task marked as Pending" });
  }
});

// Cancel Task Route
server.post('/cancel-task/:id', ensureAuthenticated, (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const task = getTasks().find(t => parseInt(t.id, 10) === taskId);
  if (!task || Number(task.userId) !== Number(req.session.user.id)) {
    return res.status(404).send('Unauthorized or task not found');
  }
  updateTask(taskId, { status: 'Cancelled' });
  req.flash('success_msg', 'Task cancelled successfully!');
  res.redirect('/');
});

// Delete Task Route
server.delete('/delete-task/:id', ensureAuthenticated, (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const task = getTasks().find(t => parseInt(t.id, 10) === taskId);
  if (!task || Number(task.userId) !== Number(req.session.user.id)) {
    return res.status(404).send('Unauthorized or task not found');
  }
  const result = deleteTask(taskId);
  if (result.success) {
    req.flash('success_msg', 'Task deleted successfully!');
    res.redirect('/');
  } else {
    req.flash('error_msg', 'Failed to delete task');
    res.redirect('/');
  }
});

// 404 Page
server.use((req, res) => {
  res.status(404).render('404');
});

// 500 Error Handler
server.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('500');
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
