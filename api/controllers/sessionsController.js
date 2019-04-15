const server = require('../../connection.js');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const privateKey = '3346841372';
const _ = require('underscore');

const authenticateUserParams = Joi.object().keys({
    email: Joi.string().lowercase().email().trim().max(60).required(),
    password: Joi.string().trim().max(255).required()
}).required();

async function authenicateUser(request, response) {
    const validationResult = Joi.validate(request.body, authenticateUserParams, { abortEarly: false });

    if (validationResult.error) {
        const errors = [];

        for (let i = 0; i < validationResult.error.details.length; i++) {
          errors.push(validationResult.error.details[i].message);
        }
    
        return response.status(400).send(errors).end();
    }

    const { email, password } = request.body
    var lowerEmail = email.toLowerCase();

    server.query('SELECT * FROM users WHERE email = $1', [lowerEmail], (error, result) => {
        if (error) {
            throw error
        }

        bcrypt.compare(password, result.rows[0].password, function (err, res) {
            if (res) {
                var payload = {
                    id: result.rows[0].id
                }
                var token = jwt.sign(payload, privateKey);

                return response.status(201).send({ msg: 'success', token: token });
            } else {
                return response.status(400).send(['Incorrect email or password']).end();
            }
        });
    })
}

module.exports = {
    authenicateUser: authenicateUser,
    privateKey: privateKey
}