Task Manager Application developed by Alejandro Meléndez for Web Development II Course.

Task-it is a sleek, modern task management web application that empowers users to efficiently organize their daily activities. Built with best practices in mind, Task-it provides a user-friendly dashboard where you can create, edit, update, and manage your tasks—all with real-time updates and advanced filtering options.

Get to experience modern productivity with the ultimate task tracker: Task-it.

Installation & Setup:

1. Clone the repository

- git clone https://github.com/aljomebe2/task-manager-app.git
- cd task-manager-app

2. Install dependencies

- npm install

3. Run App

- npm run dev

4. Open app in browser

It will run on http://localhost:3000

Key Features:
- User Authentication:
Secure user registration, login, and logout with simple implementations of hashed passwords and session management.

- Task Management:
Create, edit, and update tasks with attributes such as status (Pending, In Progress, Completed, Cancelled), priority (High, Medium, Low), due dates (with time), and completion dates.

- Real-Time Updates:
Update task statuses instantly via AJAX without refreshing the page.

- Advanced Filtering & Sorting:
Filter tasks by status, priority, and due date (e.g., Today, Tomorrow, Next Week, or a specific date). Sort tasks by name, status (custom order: Pending, In Progress, Completed, Cancelled), or due date (nearest first).

- Intuitive Dashboard:
A clean, responsive dashboard featuring a prominent "Create Task" button, an organized task table with actionable buttons (Edit, Cancel, Delete), and dedicated controls for filtering and sorting.

Now, here are the technologies and skills I recall from building this solution:

- Backend:

1. Node.js & Express: For building RESTful API and server-side logic.
2. Middleware: Sessions implemented, method-override, and connect-flash.
3. Security: Bcrypt for secure password hashing.

- Frontend:

1. Handlebars: For dynamic HTML, using layouts and partials.
2. JavaScript: Ensuring the Fetch API is updating asynchronous.

- Best Practices:

Modular code organization (with separate route files and helper functions).

Some of the new technologies I worked with aside from class applied concepts (like method override, partials using handlebars and helpers for handlebars) were:

- Bcrypt for enhanced password security which had a low level of difficulty while implementing. I was easy to define on the backend and user model.

- Implementation of AJAX. I had already seen some examples of this, but now learned to apply it to task-it to enhance fast feedback from backed to front end. The script I implemented using AJAX for the checkbox functionality to mark/unmark tasks as completed lets the response be smoother and iteractive, and more importantly withouth having to refresh the server for changes to occcur.

- Connect-flash framework for the delivery of temporary messages. Implemented in the authentication functionalities to announce invalid log-in's and failed trials.

But I also had the chance to implement technologies used in class labs like RESTful API in the different routes (endopints) used in my server. This, at the same time reinforced my knowledge on HTTP protocols's methods. I also implemented handlebars's helpers and method overrides to achieve a strong built solution.

