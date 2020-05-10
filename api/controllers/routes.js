const usersController = require('./usersController.js');
const sessionsController = require('./sessionsController.js');

function routes(app) {
    // users
    // app.get('/users', usersController.getUsers);
    app.get('/users/me', usersController.getUser);
    app.post('/users', usersController.validateCreateUser, usersController.createUser);
    app.put('/users/:id', usersController.validateUpdateUser, usersController.updateUser);
    app.put('/users/avatar/:id', usersController.validateUpdateUserAvatar, usersController.updateUserAvatar);
    app.post('/users/bugreport', usersController.validateSendBugReport, usersController.sendBugReport);
    // app.delete('/users/:id', usersController.deleteUser);

    // chat

    // sessions
    app.post('/sessions/auth', sessionsController.authenicateUser);
}

module.exports = function (app) {
    routes(app);
};