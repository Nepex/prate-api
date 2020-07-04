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

        server.query(
            'SELECT * FROM users WHERE id = $1 OR email = $2',
            [id, email],
            (error, results) => {
                if (error) {
                    return response.status(400).send(['Error loading data']);
                }

                // start validating for receiver
                if (results.rows.length === 0) {
                    return response.status(400).send(['No users found']);
                }

                let receiverFriendRequests = results.rows[0].friend_requests;

                if (receiverFriendRequests >= 50) {
                    return response.status(400).send(['Friendlist is at maximum capacity']);
                }

                if (receiverFriendRequests.indexOf(decoded.id) > -1) {
                    return response.status(400).send(['Friend request already exists.']);
                }

                if (decoded.id === results.rows[0].id || email === results.rows[0].email) {
                    return response.status(400).send(['You cannot add yourself.']);
                }

                receiverFriendRequests.push(decoded.id);

                // get sender info - make sure sender doesn't already have a pending request from receiver, then finally insert friend request
                server.query('SELECT * FROM users WHERE id = $1',
                    [decoded.id],
                    (error, results) => {
                        if (error) {
                            return response.status(400).send(['Error loading data']);
                        }

                        let senderFriendRequests = results.rows[0].friend_requests;

                        if (senderFriendRequests.indexOf(id) > -1) {
                            return response.status(400).send(['Friend request already exists.']);
                        }

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

module.exports = {
    sendFriendRequest: sendFriendRequest,
    validateSendFriendRequest: validateSendFriendRequest
}