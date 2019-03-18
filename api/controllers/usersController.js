const server = require('../../connection.js');
const bcrypt = require('bcrypt');
const uuidv4 = require('uuid/v4');
const Joi = require('joi');
const _ = require('underscore');
const user = require('../models/user');

const createUserParams = Joi.object().keys({
  name: Joi.string().trim().max(25).required(),
  email: Joi.string().lowercase().email().trim().max(60).required(),
  password: Joi.string().trim().min(5).max(255).required()
}).required();

const getUsers = (request, response) => {
  server.query('SELECT * FROM users ORDER BY id ASC', (error, results) => {
    if (error) {
      throw error
    }
    response.status(200).json(results.rows)
  })
}

const getUserById = (request, response) => {
  const id = parseInt(request.params.id)

  server.query('SELECT * FROM users WHERE id = $1', [id], (error, results) => {
    if (error) {
      throw error
    }
    response.status(200).json(results.rows)
  })
}

async function validateCreateUser(request, response, next) {
  const { email } = request.body
  const validationResult = Joi.validate(request.body, createUserParams, { abortEarly: false });

  if (validationResult.error) {
    return response.send(400, _.pluck(validationResult.error.details, 'message')).end();
  }

  user.checkEmailExists(email)
    .then(function (existingEmail) {
      if (existingEmail) {
        return response.status(400).send({ msg: 'Email already exists' }).end();
      }
      return next();
    }).catch(function (error) { console.log(error); });

}

async function createUser(request, response) {
  const { name, email, password } = request.body

  bcrypt.hash(password, 10, function (err, hash) {
    const id = uuidv4();

    server.query('INSERT INTO users (id, name, email, password) VALUES ($1, $2, $3, $4)', [id, name, email, hash], (error, result) => {
      if (error) {
        throw error
      }
      return response.status(201).send({ msg: 'success' })
    })
  });
}

const updateUser = (request, response) => {
  const id = parseInt(request.params.id)
  const { name, email } = request.body

  server.query(
    'UPDATE users SET name = $1, email = $2 WHERE id = $3',
    [name, email, id],
    (error, results) => {
      if (error) {
        throw error
      }
      response.status(200).send(`User modified with ID: ${id}`)
    }
  )
}

const deleteUser = (request, response) => {
  const id = parseInt(request.params.id)

  server.query('DELETE FROM users WHERE id = $1', [id], (error, results) => {
    if (error) {
      throw error
    }
    response.status(200).send(`User deleted with ID: ${id}`)
  })
}

module.exports = {
  getUsers: getUsers,
  getUserById: getUserById,
  validateCreateUser: validateCreateUser,
  createUser: createUser,
  updateUser: updateUser,
  deleteUser: deleteUser,
}