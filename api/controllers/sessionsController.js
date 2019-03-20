const server = require('../../connection.js');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const privateKey = '3346841372';

const authenticateUserParams = Joi.object().keys({
    email: Joi.string().lowercase().email().trim().max(60).required(),
    password: Joi.string().trim().min(5).max(255).required()
}).required();

async function authenicateUser(request, response) {
    const validationResult = Joi.validate(request.body, authenticateUserParams, { abortEarly: false });

    if (validationResult.error) {
        return response.send(400, _.pluck(validationResult.error.details, 'message')).end();
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
                return response.status(400).send({ msg: 'Incorrect email or password' }).end();
            }
        });
    })
}

module.exports = {
    authenicateUser: authenicateUser,
    privateKey: privateKey
}