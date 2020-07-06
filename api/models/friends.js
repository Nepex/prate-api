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

            // emit to each online friend that user has come online
            data.friends.forEach(friend => {
                users.forEach(usr => {
                    if (usr.id === friend) {
                        const receiverClientId = usr.clientId;

                        const body = {
                            id: data.id,
                            name: data.name,
                            avatar: data.avatar,
                            status: 'online',
                            firstConnect: true
                        };

                        friendsNs.to(`${receiverClientId}`).emit('friend-data-change-received', body);
                    }
                });
            });
        });

        socket.on('disconnect', function () {
            checkAuth(userToken, wsAuth);

            users.forEach(user => {
                if (user.clientId === socket.id) {
                    // emit to each online friend that user has disconnected
                    user.friends.forEach(friend => {
                        users.forEach(usr => {
                            if (usr.id === friend) {
                                const receiverClientId = usr.clientId;

                                const body = {
                                    id: user.id,
                                    name: user.name,
                                    avatar: user.avatar,
                                    status: 'offline'
                                };

                                friendsNs.to(`${receiverClientId}`).emit('friend-data-change-received', body);
                            }
                        });
                    });

                    // splice user
                    users.splice(users.indexOf(user), 1);
                    console.log(`${user.name} disconnected`)
                }

                // TODO: loop through friends and emit disconnections to each
            });

            socket.disconnect();
        });

        // gets all friends currently connected
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

        // checks a single friend's status
        socket.on('check-friend-status-send', function (data) {
            checkAuth(userToken, wsAuth);

            let body;

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

            // push in new friend for logged in sender
            users.forEach(user => {
                if (user.id === data.userSendingId) {
                    user.friends.push(data.userReceivingId);
                }
            });

            // search for user receiving accepted friend, see if they're online
            // if they're online, push in the received friend
            users.forEach(user => {
                if (data.userReceivingId === user.id) {
                    const receiverClientId = user.clientId;
                    user.friends.push(data.userSendingId);

                    // give them the user that accepted their friend request
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

        socket.on('friend-removal-send', function (data) {
            checkAuth(userToken, wsAuth);

            //splice out removed friend for logged in sender
            users.forEach(user => {
                if (user.id === data.userSendingId) {
                    user.friends.splice(user.friends.indexOf(data.userReceivingId), 1);
                }
            });

            // search for user receiving removed friend, see if they're online
            // if they're online, splice out the sender
            users.forEach(user => {
                if (data.userReceivingId === user.id) {
                    const receiverClientId = user.clientId;
                    user.friends.splice(user.friends.indexOf(data.userSendingId), 1);

                    // if they are..give them the user that accepted their friend request
                    users.forEach(usr => {
                        if (data.userSendingId === usr.id) {
                            const body = {
                                id: usr.id,
                            };

                            friendsNs.to(`${receiverClientId}`).emit('friend-removal-received', body);
                        }
                    });
                }
            });
        });

        // emits to friends whenever the user changes their status/avatar/name
        socket.on('friend-data-change-send', function (data) {
            checkAuth(userToken, wsAuth);

            // update sending user
            users.forEach(user => {
                if (user.id === data.id) {
                    user.name = data.name;
                    user.avatar = data.avatar;
                    user.status = data.status;

                    // emit to each online friend
                    user.friends.forEach(friend => {
                        users.forEach(usr => {
                            if (usr.id === friend) {
                                const receiverClientId = usr.clientId;

                                const body = {
                                    id: data.id,
                                    name: data.name,
                                    avatar: data.avatar,
                                    status: data.status
                                };

                                friendsNs.to(`${receiverClientId}`).emit('friend-data-change-received', body);
                            }
                        });
                    });
                }
            });
        });

    });
}

module.exports = function (io) {
    friends(io);
};