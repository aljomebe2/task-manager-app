import express from 'express';
import { engine } from 'express-handlebars';
import { getTasks, addTask, updateTask, deleteTask } from './models/Task.js';
import { addUser, findUserByEmail } from './models/User.js';
import methodOverride from 'method-override';
import session from 'express-session';
import flash from 'connect-flash';
import bcrypt from 'bcrypt';

const PORT = process.env.PORT || 3000;
const server = express();

// Register Handlebars helpers, including "eq" and "lt"
server.engine(
  'handlebars',
  engine({
    helpers: {
      eq: (a, b) => {
        return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
      },
      lt: (a, b) => {
        // Compare dates (assumes a and b are valid date strings)
        return new Date(a) < new Date(b);
      }
    },
  })
);

server.set('view engine', 'handlebars');
server.set('views', './views');

// Middleware
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
server.use(
  methodOverride(function (req, res) {
    if (req.body && typeof req.body === 'object' && '_method' in req.body) {
      const method = req.body._method;
      delete req.body._method;
      return method;
    }
  })
);

// Session management
server.use(
  session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: false,
  })
);
server.use(flash());

server.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.user = req.session.user;  
    next();
  });

// Registration
server.get('/register', (req, res) => {
  res.render('register');
});
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

// Login
server.get('/login', (req, res) => {
  res.render('login');
});
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

// Logout
server.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Home Route with filtering options
server.get('/', ensureAuthenticated, (req, res) => {
    // Get all tasks for the current user.
    let tasks = getTasks().filter(task => task.userId === req.session.user.id);
  
    // Read separate filter & sort parameters.
    const statusFilter = req.query.status || 'all';          // 'all', 'Pending', 'In progress', 'Completed', 'Cancelled'
    const priorityFilter = req.query.priority || 'all';      // 'all', 'High', 'Medium', 'Low'
    const dueFilter = req.query.due || 'all';                // 'all', 'pastDue', 'dueToday', 'dueTomorrow', 'dueNextWeek', 'specific'
    const specificDue = req.query.specificDue || '';         // a date string "YYYY-MM-DD" if dueFilter === 'specific'
    const sort = req.query.sort || '';                       // 'name', 'status', 'dueDate'
    const searchQuery = req.query.search ? req.query.search.trim().toLowerCase() : '';
    const view = req.query.view || 'default';                // 'default' (exclude cancelled) or 'all'
  
    // If default view, exclude cancelled tasks.
    if (view === 'default') {
      tasks = tasks.filter(task => task.status !== 'Cancelled');
    }
    
    // Apply status filter (if not 'all').
    if (statusFilter !== 'all') {
      tasks = tasks.filter(task => task.status.toLowerCase() === statusFilter.toLowerCase());
    }
  
    // Apply priority filter (if not 'all').
    if (priorityFilter !== 'all') {
      tasks = tasks.filter(task => task.priority.toLowerCase() === priorityFilter.toLowerCase());
    }
  
    // Due date filtering: first, compute local date strings.
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = today.toLocaleDateString('en-CA');  // Format: YYYY-MM-DD
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
        if (dueFilter === 'pastDue') {
          return dueStr < todayStr;
        } else if (dueFilter === 'dueToday') {
          return dueStr === todayStr;
        } else if (dueFilter === 'dueTomorrow') {
          return dueStr === tomorrowStr;
        } else if (dueFilter === 'dueNextWeek') {
          return dueStr > tomorrowStr && dueStr <= nextWeekStr;
        } else if (dueFilter === 'specific') {
          return dueStr === specificDue;
        }
        return true;
      });
    }
  
    // Apply search filtering.
    if (searchQuery) {
      tasks = tasks.filter(task => task.name.toLowerCase().includes(searchQuery));
    }
  
    // Sorting.
    if (sort === 'name') {
      tasks.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'status') {
      // Define a custom order: Pending (1), In progress (2), Completed (3), Cancelled (4)
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
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate) - new Date(b.dueDate);
        } else if (a.dueDate) {
          return -1;
        } else if (b.dueDate) {
          return 1;
        } else {
          return 0;
        }
      });
    }
  
    // Pass today's local date string for visual cues.
    res.render('home', { 
      tasks, 
      sort, 
      statusFilter, 
      priorityFilter, 
      dueFilter, 
      specificDue,
      search: req.query.search || '',
      view,
      today: todayStr 
    });
  });  

// Render Add Task Form
server.get('/add-task', ensureAuthenticated, (req, res) => {
  res.render('add-task');
});

/// Add Task Route
server.post('/add-task', ensureAuthenticated, (req, res) => {
    const { name, status, dueDate, completedDate, priority } = req.body;
  
    // Require name and status; dueDate is optional.
    if (!name || !status) {
      req.flash('error_msg', 'Missing task details.');
      return res.redirect('/add-task');
    }
  
    const now = new Date();
  
    if (status !== 'Completed') {
      // For non-completed tasks, if dueDate is provided, it must be at least 1 minute after now.
      if (dueDate) {
        const due = new Date(dueDate);
        if (due.getTime() < now.getTime() + 60000) {
          req.flash('error_msg', 'Due date must be at least 1 minute after the current time.');
          return res.redirect('/add-task');
        }
      }
    } else {
      // For completed tasks, a completedDate is required.
      if (!completedDate) {
        req.flash('error_msg', 'Completed tasks must have a completion date.');
        return res.redirect('/add-task');
      }
      // We do not validate dueDate when the task is completed.
    }
  
    // Pass dueDate as-is (or null if not provided)
    addTask({ name, status, dueDate: dueDate || null, completedDate, priority, userId: req.session.user.id });
    req.flash('success_msg', 'Task added successfully!');
    res.redirect('/');
  });
  
// Edit Task Form
server.get('/edit-task/:id', ensureAuthenticated, (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    const task = getTasks().find(t => parseInt(t.id, 10) === taskId);
    if (!task || Number(task.userId) !== Number(req.session.user.id)) {
      return res.status(403).send('Unauthorized or task not found');
    }
    res.render('add-task', { task });
  });

// Update Task Route
server.post('/update-task/:id', ensureAuthenticated, (req, res) => {
    const { name, status, dueDate, completedDate, priority } = req.body;
    const taskId = parseInt(req.params.id, 10);
    const task = getTasks().find(t => parseInt(t.id, 10) === taskId);
    if (!task || Number(task.userId) !== Number(req.session.user.id)) {
      return res.status(403).send('Unauthorized or task not found');
    }
  
    const now = new Date();
  
    if (status !== 'Completed') {
      // For non-completed tasks, if dueDate is provided, it must be at least 1 minute after now.
      if (dueDate) {
        const due = new Date(dueDate);
        if (due.getTime() < now.getTime() + 60000) {
          req.flash('error_msg', 'Due date must be at least 1 minute after the current time.');
          return res.redirect(`/edit-task/${taskId}`);
        }
      }
    } else {
      // For completed tasks, a completedDate is required.
      if (!completedDate) {
        req.flash('error_msg', 'Completed tasks must have a completion date.');
        return res.redirect(`/edit-task/${taskId}`);
      }
      // Again, we do not enforce any dueDate validation for completed tasks.
    }
  
    updateTask(taskId, { name, status, dueDate: dueDate || null, completedDate, priority });
    req.flash('success_msg', 'Task updated successfully!');
    res.redirect('/');
  });  

// New route for updating a task's status from home oage
server.post('/update-status/:id', ensureAuthenticated, (req, res) => {
    const { status } = req.body; // "Completed" or "Pending"
    const taskId = parseInt(req.params.id, 10);
    const task = getTasks().find(t => parseInt(t.id, 10) === taskId);
  
    if (!task || Number(task.userId) !== Number(req.session.user.id)) {
      return res.status(403).json({ success: false, message: "Unauthorized or task not found" });
    }
  
    const now = new Date();
  
    if (status === "Completed") {
      // Mark task as Completed and set its completedDate to now.
      updateTask(taskId, { status: "Completed", completedDate: now.toISOString() });
      return res.json({
        success: true,
        message: "Task marked as Completed",
        completedDate: now.toISOString()
      });
    } else {
      // For any other status (e.g. "Pending"), update accordingly.
      updateTask(taskId, { status: "Pending", completedDate: null });
      return res.json({
        success: true,
        message: "Task marked as Pending"
      });
    }
  });

// Cancelled tasks route
server.post('/cancel-task/:id', ensureAuthenticated, (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    const task = getTasks().find(t => parseInt(t.id, 10) === taskId);
    if (!task || Number(task.userId) !== Number(req.session.user.id)) {
      return res.status(403).send('Unauthorized or task not found');
    }
    updateTask(taskId, { status: 'Cancelled' });
    req.flash('success_msg', 'Task cancelled successfully!');
    res.redirect('/');
  });  
  

// Delete Task Route
server.delete('/delete-task/:id', ensureAuthenticated, (req, res) => {
  const taskId = parseInt(req.params.id);
  const task = getTasks().find((t) => t.id === taskId);
  if (!task || task.userId !== req.session.user.id) {
    return res.status(403).send('Unauthorized or task not found');
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