const usersController = require('./usersController.js');
const friendsController = require('./friendsController.js');
const sessionsController = require('./sessionsController.js');

function routes(app) {
    // users
    // app.get('/users', usersController.getUsers);
    app.get('/users/me', usersController.getUser);
    app.get('/users/:id', usersController.getUserById);
    app.post('/users', usersController.validateCreateUser, usersController.createUser);
    app.put('/users/:id', usersController.validateUpdateUser, usersController.updateUser);
    app.put('/users/avatar/:id', usersController.validateUpdateUserAvatar, usersController.updateUserAvatar);
    app.post('/users/bugreport', usersController.validateSendBugReport, usersController.sendBugReport);
    // app.delete('/users/:id', usersController.deleteUser);

    // chat

    // friends
    app.put('/friends/send-friend-request', friendsController.validateSendFriendRequest, friendsController.sendFriendRequest);
    app.get('/friends/get-friends', friendsController.getFriends);

    // sessions
    app.post('/sessions/auth', sessionsController.authenicateUser);
}

module.exports = function (app) {
    routes(app);
};