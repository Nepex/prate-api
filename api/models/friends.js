const server = require('../../connection.js');
const sessionsController = require('../controllers/sessionsController.js');
const jwt = require('jsonwebtoken');

let users = [];

function friends(io) {
    const friendsNs = io.of('/friends');

    friendsNs.on('connection', (socket) => {
        let userToken;
        let wsAuth;

        // check if auth is bad
        function checkAuth(token, wsAuth) {
            jwt.verify(token, sessionsController.privateKey, function (err, decoded) {
                if (!decoded || wsAuth !== '3346841372') {
                    socket.emit('error', 'Authentication failed');
                    socket.disconnect();
                }
            });
        }

        socket.on('storeUserInfo', function (data) {
            // check if user is already matched or matching
            userToken = data.token;
            wsAuth = data.webSocketAuth;
            checkAuth(userToken, wsAuth);

            delete data.token;
            delete data.webSocketAuth;
            data.clientId = socket.id;
            console.log('connected: ' + socket.id + ' ' + data.name);
            users.push(data);
        });

        socket.on('disconnect', function () {
            users.forEach(user => {
                if (user.clientId === socket.id) {
                    users.splice(users.indexOf(user), 1);
                }

                // TODO: loop through friends and emit disconnections to each

                console.log(`${user.name} disconnected`)
            });

            socket.disconnect();
        });

        socket.on('friend-request-send', function (data) {
            checkAuth(userToken, wsAuth);

            users.forEach(user => {
                if (data.receiverId && user.id === data.receiverId) {
                    const receiverClientId = user.clientId;
                    user.friend_requests.push(data.senderId);
                    friendsNs.to(`${receiverClientId}`).emit('friend-request-received', data);
                } else if (data.receiverEmail && user.email === data.receiverEmail) {
                    const receiverClientId = user.clientId;
                    user.friend_requests.push(data.senderId);
                    friendsNs.to(`${receiverClientId}`).emit('friend-request-received', data);
                }
            });
        });

    });
}

module.exports = function (io) {
    friends(io);
};