let users = [];

function chat(io) {
    io.on('connection', (socket) => {
        socket.on('storeUserInfo', function (data) {
            data.clientId = socket.id;
            data.currentlyMatched = false;
            data.matchedBasedOn = null;
            console.log('connected: ' + socket.id + ' ' + data.name);
            users.push(data);
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

        socket.on('error', function (err) {
            console.log('received error from client:', socket.id);
            socket.emit('error', err)
        });
    });
}

function searchForMatch(hostId, interests) {
    let interestMatchFound = false;

    if (interests.length > 0) {
        // if user has interests, loop through all users, loop through selected interests, and loop through all looking users interests for a match
        // else just match them with no interests
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

    if (!interestMatchFound){
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