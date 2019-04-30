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
                    data.currentlyMatched = false;
                    data.matchedBasedOn = null;
                    console.log('connected: ' + socket.id + ' ' + data.name);
                    users.push(data);
                }
            });
        });

        socket.on('disconnected', function (data) {
            const partnerClientId = data.receiver;

            // set host/partner disconnected
            users.forEach(user => {
                if (user.clientId === socket.id) {
                    users.splice(users.indexOf(user), 1);
                    console.log(user.name + ' disconnected');
                }
            });

            users.forEach(user => {
                if (user.clientId === partnerClientId) {
                    users.splice(users.indexOf(user), 1);
                    console.log(user.name + ' disconnected');
                }
            });

            io.to(`${partnerClientId}`).emit('partnerDisconnected');
            socket.disconnect();
        });

        socket.on('killSocketConnection', function () {
            socket.disconnect();
        });

        socket.on('searchForMatch', function (user) {
            // recall on front end with interval
            const partner = searchForMatch(socket.id, user.interests);

            if (!partner) {
                socket.emit('matchResults', null)
            } else {
                let host;
                const partnerClientId = partner.clientId;

                // set host match - set up host data to emit to partner
                users.forEach(user => {
                    if (user.clientId === socket.id) {
                        user.currentlyMatched = true;
                        host = user;
                        host.matchedBasedOn = partner.matchedBasedOn
                        socket.emit('matchResults', partner);
                    }
                });

                // set partner match
                users.forEach(user => {
                    if (user.clientId === partner.clientId) {
                        user.currentlyMatched = true;
                        io.to(`${partnerClientId}`).emit('matchResults', host);
                    }
                });
            }
        });

        socket.on('cancelMatching', function (data) {
            users.forEach(user => {
                if (user.clientId === socket.id) {
                    users.splice(users.indexOf(user), 1);
                    console.log(user.name + ' disconnected');
                    socket.disconnect();
                }
            });
        })

        socket.on('message-send', function (data) {
            const partnerClientId = data.receiver;
            io.to(`${partnerClientId}`).emit('message-received', data);
        });

        socket.on('user-typed', function (data) {
            const partnerClientId = data.receiver;
            io.to(`${partnerClientId}`).emit('user-typed', data);
        });

        socket.on('awardExp', function (data) {
            jwt.verify(data.token, sessionsController.privateKey, function (err, decoded) {
                if (!decoded || data.webSocketAuth !== '3346841372') {
                    socket.emit('matchError', 'Authentication failed');
                    socket.disconnect();
                } else {
                    server.query(
                        'UPDATE users SET experience = $1 WHERE id = $2',
                        [data.exp, decoded.id],
                        (error, results) => {
                            if (error) {
                                throw error
                            }
                        });
                    socket.disconnect();
                }
            });
        });

        socket.on('error', function (err) {
            console.log('received error from client:', socket.id);
            socket.emit('error', err);
        });
    });
}

function searchForMatch(hostId, interests) {
    let interestMatchFound = false;

    if (interests.length > 0) {
        for (let i = 0; i < users.length; i++) {
            for (let j = 0; j < users[i].interests.length; j++) {
                for (let k = 0; k < interests.length; k++) {
                    if (!users[i].currentlyMatched && users[i].clientId !== hostId && interests[k] === users[i].interests[j]) {
                        interestMatchFound = true;
                        users[i].matchedBasedOn = interests[k];

                        return users[i];
                    }
                }
            }
        }
    }

    if (!interestMatchFound) {
        for (let i = 0; i < users.length; i++) {
            if (!users[i].currentlyMatched && users[i].clientId !== hostId) {
                users[i].matchedBasedOn = null;
                return users[i];
            }
        }
    }

    return false;
}

module.exports = function (io) {
    chat(io);
};