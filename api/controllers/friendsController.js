const server = require('../../connection.js');
const Joi = require('joi');
const user = require('../models/user');
const jwt = require('jsonwebtoken');
const sessionsController = require('./sessionsController.js');

const sendFriendRequestParams = Joi.alternatives().try(
    Joi.object().keys({
        id: Joi.string().guid({ version: ['uuidv4'] }).required(),
        email: Joi.string().lowercase().email().trim().max(60)
    }),
    Joi.object().keys({
        id: Joi.string().guid({ version: ['uuidv4'] }),
        email: Joi.string().lowercase().email().trim().max(60).required(),
    })
);

async function validateSendFriendRequest(request, response, next) {
    const validationResult = Joi.validate(request.body, sendFriendRequestParams, { abortEarly: false });

    if (validationResult.error) {
        const errors = [];

        for (let i = 0; i < validationResult.error.details.length; i++) {
            errors.push(validationResult.error.details[i].message);
        }

        return response.status(400).send(errors);
    }

    return next();
}

async function sendFriendRequest(request, response) {
    const { id, email } = request.body
    const token = request.headers.authorization.split(' ')[1];

    jwt.verify(token, sessionsController.privateKey, function (err, decoded) {
        if (!decoded) {
            return response.status(400).send([err]).end();
        }

        // get user receiving the friend request
        server.query(
            'SELECT * FROM users WHERE id = $1 OR email = $2',
            [id, email],
            (error, receiverResults) => {
                if (error) {
                    return response.status(400).send(['Error loading data']);
                }

                // start validating for receiver
                if (receiverResults.rows.length === 0) {
                    return response.status(400).send(['No users found']);
                }

                if (decoded.id === id) {
                    return response.status(400).send(['You cannot add yourself']);
                }


                let receiverFriendRequests = receiverResults.rows[0].friend_requests;

                if (receiverFriendRequests.length >= 50) {
                    return response.status(400).send(['Friend requests is at maximum capacity']);
                }

                if (receiverFriendRequests.indexOf(decoded.id) > -1) {
                    return response.status(400).send(['Friend request already exists']);
                }

                receiverFriendRequests.push(decoded.id);

                // get sender info - make sure sender doesn't already have a pending request from receiver, then finally insert friend request
                server.query('SELECT * FROM users WHERE id = $1',
                    [decoded.id],
                    (error, senderResults) => {
                        if (error) {
                            return response.status(400).send(['Error loading data']);
                        }

                        let senderFriendRequests = senderResults.rows[0].friend_requests;

                        if (email === senderResults.rows[0].email) {
                            return response.status(400).send(['You cannot add yourself']);
                        }

                        if (senderFriendRequests.indexOf(receiverResults.rows[0].id) > -1) {
                            return response.status(400).send(['Friend request already exists']);
                        }
                        
                        // insert friend request into receiver's friend requests
                        server.query(
                            'UPDATE users SET friend_requests = $1 WHERE id = $2 OR email = $3',
                            [receiverFriendRequests, id, email],
                            (error, results) => {
                                if (error) {
                                    return response.status(400).send(['Error loading data']);
                                }
                                response.status(200).send({ msg: 'success' });
                            });
                    });
            });
    });
}

const getFriendRequests = (request, response) => {
    const token = request.headers.authorization.split(' ')[1];

    jwt.verify(token, sessionsController.privateKey, function (err, decoded) {
        if (!decoded) {
            return response.status(400).send([err]).end();
        }

        // get user's friend request ids
        server.query('SELECT * FROM users WHERE id = $1', [decoded.id], (error, userResults) => {
            if (error) {
                return response.status(400).send(['Error loading data']);
            }

            const userFriendIds = userResults.rows[0].friend_requests;

            // loop through all users, populate a friends array with their data and return
            server.query('SELECT * FROM users ORDER BY name ASC', (error, allUsersResults) => {
                if (error) {
                    return response.status(400).send(['Error loading data']);
                }

                let friends = [];

                const allUsers = allUsersResults.rows;

                allUsers.forEach(user => {
                    userFriendIds.forEach(friendId => {
                        if (user.id === friendId) {
                            friends.push({
                                id: user.id,
                                name: user.name,
                                avatar: user.avatar
                            });
                        }
                    });
                });

                response.status(200).json(friends);
            });
        });
    });
}

const getFriends = (request, response) => {
    const token = request.headers.authorization.split(' ')[1];

    jwt.verify(token, sessionsController.privateKey, function (err, decoded) {
        if (!decoded) {
            return response.status(400).send([err]).end();
        }

        // get user's friend ids
        server.query('SELECT * FROM users WHERE id = $1', [decoded.id], (error, userResults) => {
            if (error) {
                return response.status(400).send(['Error loading data']);
            }

            const userFriendIds = userResults.rows[0].friends;

            // loop through all users, populate a friends array with their data and return
            server.query('SELECT * FROM users ORDER BY name ASC', (error, allUsersResults) => {
                if (error) {
                    return response.status(400).send(['Error loading data']);
                }

                let friends = [];

                const allUsers = allUsersResults.rows;

                allUsers.forEach(user => {
                    userFriendIds.forEach(friendId => {
                        if (user.id === friendId) {
                            friends.push({
                                id: user.id,
                                name: user.name,
                                avatar: user.avatar,
                                status: 'offline'
                            });
                        }
                    });
                });

                response.status(200).json(friends);
            });
        });
    });
}

async function acceptFriendRequest(request, response) {
    const id = request.params.id;
    const token = request.headers.authorization.split(' ')[1];

    if (id.length > 100) {
        return response.status(400).send(['ID exceeds maximum characters']);
    }

    jwt.verify(token, sessionsController.privateKey, function (err, decoded) {
        if (!decoded) {
            return response.status(400).send([err]).end();
        }

        // get user accepting the request
        server.query(
            'SELECT * FROM users WHERE id = $1',
            [decoded.id],
            (error, senderResults) => {
                if (error) {
                    return response.status(400).send(['Error loading data']);
                }

                let senderFriendRequests = senderResults.rows[0].friend_requests;
                let senderFriends = senderResults.rows[0].friends;

                if (senderFriends.length >= 50) {
                    return response.status(400).send(['Friendlist is at maximum capacity']);
                }

                if (senderFriendRequests.indexOf(id) < 0) {
                    return response.status(400).send(['No active friend request for that user']);
                }

                if (senderFriends.indexOf(id) > -1) {
                    return response.status(400).send(['You\'re already friends with that user']);
                }

                senderFriendRequests.splice(senderFriendRequests.indexOf(id), 1);
                senderFriends.push(id);
                
                // add the friend to the user accepting the request
                server.query(
                    'UPDATE users SET friends = $1, friend_requests = $2 WHERE id = $3',
                    [senderFriends, senderFriendRequests, decoded.id],
                    (error, senderUpdateResults) => {
                        if (error) {
                            return response.status(400).send(['Error loading data']);
                        }

                        // get the user receiving the accepted friend request
                        server.query(
                            'SELECT * FROM users WHERE id = $1',
                            [id],
                            (error, receiverResults) => {
                                if (error) {
                                    return response.status(400).send(['Error loading data']);
                                }

                                let receiverFriends = receiverResults.rows[0].friends;

                                if (receiverFriends.indexOf(decoded.id) > -1) {
                                    return response.status(400).send(['You\'re already friends with that user']);
                                }

                                receiverFriends.push(decoded.id);
                                
                                // add the user that has accepted their friend request
                                server.query(
                                    'UPDATE users SET friends = $1 WHERE id = $2',
                                    [receiverFriends, id],
                                    (error, receiverUpdateResults) => {
                                        if (error) {
                                            return response.status(400).send(['Error loading data']);
                                        }
                                        response.status(200).send({ msg: 'success' });
                                    });
                            });
                    });
            });
    });
}

async function denyFriendRequest(request, response) {
    const id = request.params.id;
    const token = request.headers.authorization.split(' ')[1];

    if (id.length > 100) {
        return response.status(400).send(['ID exceeds maximum characters']);
    }

    jwt.verify(token, sessionsController.privateKey, function (err, decoded) {
        if (!decoded) {
            return response.status(400).send([err]).end();
        }

        server.query(
            'SELECT * FROM users WHERE id = $1',
            [decoded.id],
            (error, userResults) => {
                if (error) {
                    return response.status(400).send(['Error loading data']);
                }

                let userFriendRequests = userResults.rows[0].friend_requests;

                userFriendRequests.splice(userFriendRequests.indexOf(id), 1);

                server.query(
                    'UPDATE users SET friend_requests = $1 WHERE id = $2',
                    [userFriendRequests, decoded.id],
                    (error, results) => {
                        if (error) {
                            return response.status(400).send(['Error loading data']);
                        }
                        response.status(200).send({ msg: 'success' });
                    });
            });
    });
}

async function removeFriend(request, response) {
    const id = request.params.id;
    const token = request.headers.authorization.split(' ')[1];

    if (id.length > 100) {
        return response.status(400).send(['ID exceeds maximum characters']);
    }

    jwt.verify(token, sessionsController.privateKey, function (err, decoded) {
        if (!decoded) {
            return response.status(400).send([err]).end();
        }

        // get the user who requested to have one of their friends removed
        server.query(
            'SELECT * FROM users WHERE id = $1',
            [decoded.id],
            (error, senderResults) => {
                if (error) {
                    return response.status(400).send(['Error loading data']);
                }

                let senderFriends = senderResults.rows[0].friends;

                senderFriends.splice(senderFriends.indexOf(id), 1);

                // remove the friend from their friends
                server.query(
                    'UPDATE users SET friends = $1 WHERE id = $2',
                    [senderFriends, decoded.id],
                    (error, senderUpdateResults) => {
                        if (error) {
                            return response.status(400).send(['Error loading data']);
                        }

                        // get the user who was removed
                        server.query(
                            'SELECT * FROM users WHERE id = $1',
                            [id],
                            (error, receiverResults) => {
                                if (error) {
                                    return response.status(400).send(['Error loading data']);
                                }

                                let receiverFriends = receiverResults.rows[0].friends;

                                receiverFriends.splice(receiverFriends.indexOf(id), 1);

                                // remove the person who removed them from their friends as well
                                server.query(
                                    'UPDATE users SET friends = $1 WHERE id = $2',
                                    [receiverFriends, id],
                                    (error, receiverUpdateResults) => {
                                        if (error) {
                                            return response.status(400).send(['Error loading data']);
                                        }
                                        response.status(200).send({ msg: 'success' });
                                    });
                            });
                    });
            });
    });
}

module.exports = {
    sendFriendRequest: sendFriendRequest,
    validateSendFriendRequest: validateSendFriendRequest,
    getFriends: getFriends,
    getFriendRequests: getFriendRequests,
    acceptFriendRequest: acceptFriendRequest,
    denyFriendRequest: denyFriendRequest,
    removeFriend: removeFriend
}