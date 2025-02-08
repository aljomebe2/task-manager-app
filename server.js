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
    let tasks = getTasks().filter(task => task.userId === req.session.user.id);
    const { sort, filter, search } = req.query;
  
    // First, filtering by status if filter is "completed" or "incomplete"
    if (filter === 'completed') {
      tasks = tasks.filter(task => task.status === 'Completed');
    } else if (filter === 'incomplete') {
      tasks = tasks.filter(task => task.status !== 'Completed');
    }
  
    // Compute date strings for filtering in local time
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayString = today.toLocaleDateString('en-CA'); // Format: YYYY-MM-DD
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toLocaleDateString('en-CA');
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekString = nextWeek.toLocaleDateString('en-CA');
  
    // Filtering by due dates – compare using local date strings
    if (filter === 'pastDue') {
      tasks = tasks.filter(task => {
        const dueStr = new Date(task.dueDate).toLocaleDateString('en-CA');
        return dueStr < todayString;
      });
    } else if (filter === 'dueToday') {
      tasks = tasks.filter(task => {
        const dueStr = new Date(task.dueDate).toLocaleDateString('en-CA');
        return dueStr === todayString;
      });
    } else if (filter === 'dueTomorrow') {
      tasks = tasks.filter(task => {
        const dueStr = new Date(task.dueDate).toLocaleDateString('en-CA');
        return dueStr === tomorrowString;
      });
    } else if (filter === 'dueNextWeek') {
      tasks = tasks.filter(task => {
        const dueStr = new Date(task.dueDate).toLocaleDateString('en-CA');
        return dueStr > tomorrowString && dueStr <= nextWeekString;
      });
    }
  
    // Search by task name
    const searchQuery = search ? search.trim().toLowerCase() : '';
    if (searchQuery) {
      tasks = tasks.filter(task => task.name.toLowerCase().includes(searchQuery));
    }
  
    // Sorting tasks
    if (sort === 'name') tasks = tasks.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'status') tasks = tasks.sort((a, b) => a.status.localeCompare(b.status));
    else if (sort === 'date') tasks = tasks.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    else if (sort === 'dueDate') tasks = tasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  
    // Pass today's date (local) to the template for visual cues
    res.render('home', { tasks, sort, filter, search, today: todayString });
  });
  

// Render Add Task Form
server.get('/add-task', ensureAuthenticated, (req, res) => {
  res.render('add-task');
});

/// Add Task Route
server.post('/add-task', ensureAuthenticated, (req, res) => {
    const { name, status, dueDate, completedDate } = req.body;
  
    if (!name || !status || !dueDate) {
      req.flash('error_msg', 'Missing task details.');
      return res.redirect('/add-task');
    }
  
    // Parse the due date as a date-time value
    const now = new Date();
    const due = new Date(dueDate);
  
    // Require that the due date/time is at least one minute after now
    if (due.getTime() < now.getTime() + 60000) {
      req.flash('error_msg', 'Due date must be at least 1 minute after the current time.');
      return res.redirect('/add-task');
    }
  
    if (status === 'Completed' && !completedDate) {
      req.flash('error_msg', 'Completed tasks must have a completion date.');
      return res.redirect('/add-task');
    }
  
    addTask({ name, status, dueDate, completedDate, userId: req.session.user.id });
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
    const { name, status, dueDate, completedDate } = req.body;
    const taskId = parseInt(req.params.id, 10);
    const task = getTasks().find(t => parseInt(t.id, 10) === taskId);
    if (!task || Number(task.userId) !== Number(req.session.user.id)) {
      return res.status(403).send('Unauthorized or task not found');
    }
  
    const now = new Date();
    const due = new Date(dueDate);
    // Validate that the due date/time is at least one minute after now
    if (due.getTime() < now.getTime() + 60000) {
      req.flash('error_msg', 'Due date must be at least 1 minute after the current time.');
      return res.redirect(`/edit-task/${taskId}`);
    }
  
    if (status === 'Completed' && !completedDate) {
      req.flash('error_msg', 'Completed tasks must have a completion date.');
      return res.redirect(`/edit-task/${taskId}`);
    }
  
    updateTask(taskId, { name, status, dueDate, completedDate });
    req.flash('success_msg', 'Task updated successfully!');
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
