const usersController = require('./usersController.js');
const sessionsController = require('./sessionsController.js');

function routes(app) {
    // users
    app.get('/users', usersController.getUsers);
    app.get('/users/me', usersController.getUser);
    app.post('/users', usersController.validateCreateUser, usersController.createUser);
    app.put('/users/:id', usersController.updateUser);
    app.delete('/users/:id', usersController.deleteUser);

    // sessions
    app.post('/sessions/auth', sessionsController.authenicateUser);
}

module.exports = function (app) {
    routes(app);
};