let users = [];

function chat(io) {
    io.on('connection', (socket) => {
        let host;

        // emit (event, data) ->
        // socket.emit('connected', 'you connected son');

        socket.on('storeUserInfo', function (data) {
            data.clientId = socket.id;
            data.chattingWith = null;
            host = data;
            users.push(data);
        });

        socket.on('searchForMatch', function (data) {
            // recall on front end in interval everytime null is returned
            const match = searchForMatch();

            if (!match) {
                // no match found
                socket.emit('matchResults', null)
            } else {
                // match found
                host.chattingWith = personFound;

                users.forEach(user => {
                    if (user.clientId === host.clientId) {
                        user = host;
                        socket.emit('matchResults', personFound);
                    }

                    if (user.clientId === personFound.clientId) {
                        const personFoundClientId = personFound.clientId;
                        personFound.chattingWith = host;
                        io.to(`${personFoundClientId}`).emit('matchResults', host);
                    }
                });
            }
        });

        socket.on('message-send', function (data) {
            users.forEach(user => {
                if (user.clientId === socket.id) {
                    const partnerSocketId = user.chattingWith.clientId;

                    io.to(`${partnerSocketId}`).emit('message-received', data);

                }
            });
        });

        socket.on('disconnect', function () {
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

function searchForMatch() {
    for (let i = 0; i < users.length; i++) {
        if (!users[i].chattingWith) {
            return user;
        }
    }

    return false;
}

module.exports = function (io) {
    chat(io);
};