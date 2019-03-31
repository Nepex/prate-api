let users = [];

function chat(io) {
    io.on('connection', (socket) => {
        socket.on('storeUserInfo', function (data) {
            data.clientId = socket.id;
            data.currentlyMatched = false;
            console.log('connected: ' + socket.id + ' ' + data.name);
            users.push(data);
        });

        socket.on('searchForMatch', function (data) {
            // recall on front end with interval
            const partner = searchForMatch(socket.id);

            if (!partner) {
                socket.emit('matchResults', null)
            } else {
                let host;
                const partnerClientId = partner.clientId;

                // set host match
                users.forEach(user => {
                    if (user.clientId === socket.id) {
                        user.currentlyMatched = true;
                        host = user;
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

        socket.on('message-send', function (data) {
            const partnerClientId = data.receiver;
            io.to(`${partnerClientId}`).emit('message-received', data);
        });

        socket.on('user-typed', function (data) {
            const partnerClientId = data.receiver;
            io.to(`${partnerClientId}`).emit('user-typed', data);
        });

        socket.on('disconnect', function () {
            // emit disconnection to partner, and disconnect them on frontend
            users.forEach(user => {
                if (user.clientId === socket.id) {
                    users.splice(user, 1);
                    console.log(user.name + ' disconnected');
                }
            });
        });

        socket.on('error', function (err) {
            console.log('received error from client:', socket.id);
            console.log(err);
            socket.emit('error', err)
        });
    });
}

function searchForMatch(hostId) {
    for (let i = 0; i < users.length; i++) {
        if (!users[i].currentlyMatched && users[i].clientId !== hostId) {
            return users[i];
        }
    }

    return false;
}

module.exports = function (io) {
    chat(io);
};