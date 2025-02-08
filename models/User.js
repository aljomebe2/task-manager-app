import fs from 'fs';

const usersFile = './assets/users.json';

// Load users from file
export const loadUsers = () => {
    try {
        const data = fs.readFileSync(usersFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

// Save users to file
export const saveUsers = (users) => {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
};

// Find user by email
export function findUserByEmail(email) {
    const users = loadUsers();
    return users.find(user => user.email === email);
}

// Add a user 
export function addUser(user) {
    const users = loadUsers();
    
    const newId = users.length > 0 ? Math.max(...users.map(u => u.id || 0)) + 1 : 1;

    const newUser = { id: newId, ...user };
    users.push(newUser);
    
    saveUsers(users);
}
