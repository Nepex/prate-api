const server = require('../../connection.js');
const sessionsController = require('../controllers/sessionsController.js');
const jwt = require('jsonwebtoken');

let users = [];

function chat(io) {
    io.on('connection', (socket) => {
        socket.on('authAndStoreUserInfo', function (data) {
            jwt.verify(data.token, sessionsController.privateKey, function (err, decoded) {
                // check if auth is bad
                if (!decoded || data.webSocketAuth !== '3346841372') {
                    socket.emit('matchError', 'Authentication failed');
                    socket.disconnect();
                } else {
                    // check if user is already matched or matching
                    let userAlreadyMatched;

                    users.forEach(user => {
                        if (data.id === user.id) {
                            socket.emit('matchError', 'You are already matching/matched!');
                            socket.disconnect();

                            userAlreadyMatched = true;
                        }
                    });

                    if (userAlreadyMatched) {
                        return;
                    }

                    delete data.token;
                    delete data.webSocketAuth;
                    data.clientId = socket.id;
                    data.currentlyMatchedWith = null;
                    data.matchedBasedOn = null;
                    console.log('connected: ' + socket.id + ' ' + data.name);
                    users.push(data);
                }
            });
        });

        socket.on('searchForMatch', function (user) {
            // recall on front end with interval
            const partner = searchForMatch(socket.id, user.interests, user.enforce_interests);

            if (!partner) {
                socket.emit('matchResults', null)
            } else {
                let host;
                const partnerClientId = partner.clientId;

                // set host match - set up host data to emit to partner
                users.forEach(user => {
                    if (user.clientId === socket.id) {
                        user.currentlyMatchedWith = partnerClientId;
                        host = user;
                        host.matchedBasedOn = partner.matchedBasedOn;
                        socket.emit('matchResults', partner);
                    }
                });

                // set partner match
                users.forEach(user => {
                    if (user.clientId === partner.clientId) {
                        user.currentlyMatchedWith = host.clientId;
                        io.to(`${partnerClientId}`).emit('matchResults', host);
                    }
                });
            }
        });

        socket.on('disconnect', function () {
            let host;

            users.forEach(user => {
                if (user.clientId === socket.id) {
                    host = user;
                    users.splice(users.indexOf(user), 1);


                    // disconnect partner too if matched
                    if (host.currentlyMatchedWith) {
                        users.forEach(user => {
                            if (user.clientId === host.currentlyMatchedWith) {
                                users.splice(users.indexOf(user), 1);

                                io.to(`${host.currentlyMatchedWith}`).emit('partnerDisconnected');
                            }
                        });
                    }
                }
            });

            socket.disconnect();
        });

        socket.on('message-send', function (data) {
            const partnerClientId = data.receiver;

            io.to(`${partnerClientId}`).emit('message-received', data);
        });

        socket.on('outer-app-invite-send', function (data) {
            const partnerClientId = data.receiver;

            io.to(`${partnerClientId}`).emit('outer-app-invite-received', data);
        });

        socket.on('outer-app-invite-accept', function (data) {
            const partnerClientId = data.receiver;

            io.to(`${partnerClientId}`).emit('outer-app-invite-accept', data);
        });

        socket.on('outer-app-invite-cancel', function (data) {
            const partnerClientId = data.receiver;

            io.to(`${partnerClientId}`).emit('outer-app-invite-cancel', data);
        });

        socket.on('toggle-outer-app-function', function (data) {
            const partnerClientId = data.receiver;

            io.to(`${partnerClientId}`).emit('toggle-outer-app-function', data);
        });

        socket.on('user-typed', function (data) {
            const partnerClientId = data.receiver;
            io.to(`${partnerClientId}`).emit('user-typed', data);
        });

        socket.on('error', function (err) {
            console.log('received error from client:', socket.id);
            socket.emit('error', err);
        });
    });
}

function searchForMatch(hostId, interests, enforceInterests) {
    let interestMatchFound = false;

    if (interests.length > 0) {
        for (let i = 0; i < users.length; i++) {
            for (let j = 0; j < users[i].interests.length; j++) {
                for (let k = 0; k < interests.length; k++) {
                    if (!users[i].currentlyMatchedWith && users[i].clientId !== hostId && interests[k] === users[i].interests[j]) {
                        interestMatchFound = true;
                        users[i].matchedBasedOn = interests[k];

                        return users[i];
                    }
                }
            }
        }
    }

    // find no common interests partner if enforce interests is false or if it's true but there are no interests selected
    if ((enforceInterests && interests.length === 0) || !enforceInterests) {
        if (!interestMatchFound) {
            for (let i = 0; i < users.length; i++) {
                if (!users[i].currentlyMatchedWith && users[i].clientId !== hostId && ((users[i].enforce_interests && users[i].interests.length === 0) || !users[i].enforce_interests)) {
                    users[i].matchedBasedOn = null;

                    return users[i];
                }
            }
        }
    }

    return false;
}

module.exports = function (io) {
    chat(io);
};