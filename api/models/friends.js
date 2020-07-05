const server = require('../../connection.js');
const sessionsController = require('../controllers/sessionsController.js');
const jwt = require('jsonwebtoken');

let users = [];

function friends(io) {
    const friendsNs = io.of('/friends');

    friendsNs.on('connection', (socket) => {
        let userToken;
        let wsAuth;

        // find bette ws auth
        function checkAuth(token, wsAuth) {
            jwt.verify(token, sessionsController.privateKey, function (err, decoded) {
                if (!decoded || wsAuth !== '3346841372') {
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
            checkAuth(userToken, wsAuth);

            users.forEach(user => {
                if (user.clientId === socket.id) {
                    users.splice(users.indexOf(user), 1);
                    console.log(`${user.name} disconnected`)
                }

                // TODO: loop through friends and emit disconnections to each
            });

            socket.disconnect();
        });

        socket.on('get-online-friends', function (data) {
            checkAuth(userToken, wsAuth);

            let onlineFriends = [];

            data.forEach(friendId => {
                users.forEach(user => {
                    if (user.id === friendId) {
                        onlineFriends.push({
                            id: user.id,
                            name: user.name,
                            avatar: user.avatar,
                            status: user.status
                        });
                    }
                });
            });

            friendsNs.to(`${socket.id}`).emit('receive-online-friends', onlineFriends);
        });

        socket.on('check-friend-status-send', function (data) {
            checkAuth(userToken, wsAuth);

            let body;

            console.log(socket.id);

            users.forEach(user => {
                if (data.id === user.id) {
                    body = {
                        id: user.id,
                        name: user.name,
                        avatar: user.avatar,
                        status: user.status
                    };

                    friendsNs.to(`${socket.id}`).emit('check-friend-status-received', body);
                }
            });

            if (!body) {
                friendsNs.to(`${socket.id}`).emit('check-friend-status-received', { id: data.id, status: 'offline' });
            }
        });

        socket.on('friend-request-send', function (data) {
            checkAuth(userToken, wsAuth);

            users.forEach(user => {
                if (data.receiverId && user.id === data.receiverId && user.id !== data.senderId) {
                    const receiverClientId = user.clientId;
                    friendsNs.to(`${receiverClientId}`).emit('friend-request-received', data);
                } else if (data.receiverEmail && user.email === data.receiverEmail && data.receiverEmail !== data.senderEmail) {
                    const receiverClientId = user.clientId;
                    friendsNs.to(`${receiverClientId}`).emit('friend-request-received', data);
                }
            });
        });

        socket.on('accepted-friend-request-send', function (data) {
            checkAuth(userToken, wsAuth);

            // search for user receiving accepted friend, see if they're online
            users.forEach(user => {
                if (data.userReceivingId === user.id) {
                    const receiverClientId = user.clientId;

                    // if they are..give them the user that accepted their friend request
                    users.forEach(usr => {
                        if (data.userSendingId === usr.id) {
                            const body = {
                                id: usr.id,
                                name: usr.name,
                                avatar: usr.avatar,
                                status: usr.status
                            };

                            friendsNs.to(`${receiverClientId}`).emit('accepted-friend-request-received', body);
                        }
                    });

                }
            });
        });

    });
}

module.exports = function (io) {
    friends(io);
};