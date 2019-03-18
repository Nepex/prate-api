const usersController = require('./usersController.js');

function routes(app) {
    // users
    app.get('/users', usersController.getUsers)
    app.get('/users/:id', usersController.getUserById)
    app.post('/users', usersController.validateCreateUser, usersController.createUser)
    app.put('/users/:id', usersController.updateUser)
    app.delete('/users/:id', usersController.deleteUser)
}

module.exports = function (app) {
    routes(app);
};