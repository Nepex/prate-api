const server = require('../../connection.js');
const bcrypt = require('bcrypt');
const uuidv4 = require('uuid/v4');
const Joi = require('joi');
const _ = require('underscore');
const user = require('../models/user');
const jwt = require('jsonwebtoken');
const sessionsController = require('./sessionsController.js');
const nodemailer = require('nodemailer');

const createUserParams = Joi.object().keys({
  name: Joi.string().trim().max(25).required(),
  email: Joi.string().lowercase().email().trim().max(60).required(),
  password: Joi.string().trim().min(5).max(255).required()
}).required();

const updateUserParams = Joi.object().keys({
  id: Joi.string().guid({ version: ['uuidv4'] }).required(),
  name: Joi.string().trim().max(25).required(),
  interests: Joi.array().max(8).items(Joi.string().trim().lowercase()).single(),
  font_face: Joi.string().trim().max(25).required(),
  font_color: Joi.string().trim().hex().max(9).required(),
  bubble_color: Joi.string().trim().hex().max(9).required(),
  experience: Joi.number().max(46963200).required(),
  show_avatars: Joi.boolean().required(),
  bubble_layout: Joi.string().trim().max(20).valid('alternating', 'all_left').required(),
  oldPassword: Joi.string().trim().min(5).max(255).empty(null),
  newPassword: Joi.string().trim().min(5).max(255).empty(null),
}).and('oldPassword', 'newPassword');

const updateUserAvatarParams = Joi.object().keys({
  avatar: Joi.string().trim().max(25).min(1).required(),
}).required();

const sendBugReportParams = Joi.object().keys({
  message: Joi.string().trim().max(200).required(),
}).required();

const getUsers = (request, response) => {
  server.query('SELECT * FROM users ORDER BY id ASC', (error, results) => {
    if (error) {
      throw error
    }
    response.status(200).json(results.rows);
  })
}

async function getUser(request, response) {
  const token = request.headers.authorization.split(' ')[1];

  jwt.verify(token, sessionsController.privateKey, function (err, decoded) {
    if (!decoded) {
      return response.status(400).send([err]).end();
    }

    server.query('SELECT * FROM users WHERE id = $1', [decoded.id], (error, results) => {
      if (error) {
        throw error
      }

      const user = results.rows[0];
      delete user.password
      response.status(200).json(user);
    });
  });
}

async function validateCreateUser(request, response, next) {
  const { email } = request.body
  const validationResult = Joi.validate(request.body, createUserParams, { abortEarly: false });

  if (validationResult.error) {
    const errors = [];

    for (let i = 0; i < validationResult.error.details.length; i++) {
      errors.push(validationResult.error.details[i].message);
    }

    return response.status(400).send(errors).end();
  }

  // future tip: use promise.all if multiple validations from db are required
  var lowerEmail = email.toLowerCase();
  user.checkEmailExists(lowerEmail)
    .then(function (existingEmail) {
      if (existingEmail) {
        return response.status(400).send(['Email already exists']).end();
      }
      return next();
    }).catch(function (error) { console.log(error); });
}

async function createUser(request, response) {
  const { name, email, password } = request.body
  var lowerEmail = email.toLowerCase();

  bcrypt.hash(password, 10, function (err, hash) {
    const id = uuidv4();

    server.query('INSERT INTO users (id, name, email, password) VALUES ($1, $2, $3, $4)', [id, name, lowerEmail, hash], (error, result) => {
      if (error) {
        throw error
      }
      return response.status(201).send({ msg: 'success' });
    })
  });
}

async function validateUpdateUser(request, response, next) {
  const { newPassword, oldPassword } = request.body

  const token = request.headers.authorization.split(' ')[1];
  const validationResult = Joi.validate(request.body, updateUserParams, { abortEarly: false });

  if (validationResult.error) {
    const errors = [];

    for (let i = 0; i < validationResult.error.details.length; i++) {
      errors.push(validationResult.error.details[i].message);
    }

    return response.status(400).send(errors).end();
  }

  if (newPassword) {
    jwt.verify(token, sessionsController.privateKey, function (err, decoded) {
      if (!decoded) {
        return response.status(400).send([err]).end();
      }

      user.checkPasswordCorrect(decoded.id, oldPassword)
        .then(function (res) {
          return next();
        }).catch(function (error) {
          return response.status(400).send(['Incorrect password']).end();
        });
    });
  } else {
    return next();
  }
}

const updateUser = (request, response) => {
  const { name, newPassword, interests, font_face, font_color, bubble_color, experience, show_avatars, bubble_layout } = request.body
  const token = request.headers.authorization.split(' ')[1];

  jwt.verify(token, sessionsController.privateKey, function (err, decoded) {
    if (!decoded) {
      return response.status(400).send([err]).end();
    }

    server.query(
      'SELECT * FROM users WHERE id = $1',
      [decoded.id],
      (error, results) => {
        if (error) {
          throw error
        }

        bcrypt.hash(newPassword, 10, function (err, hash) {
          let password;

          if (!newPassword) {
            password = results.rows[0].password;
          } else {
            password = hash;
          }
          server.query(
            'UPDATE users SET name = $1, interests = $2, password = $3, font_face = $4, font_color = $5, bubble_color = $6, experience = $7, show_avatars = $8, bubble_layout = $9 WHERE id = $10',
            [name, interests, password, font_face, font_color, bubble_color, experience, show_avatars, bubble_layout, decoded.id],
            (error, results) => {
              if (error) {
                throw error
              }
              response.status(200).send({ msg: 'success' });
            });
        });

      }
    )

  });
}

async function validateUpdateUserAvatar(request, response, next) {
  const validationResult = Joi.validate(request.body, updateUserAvatarParams, { abortEarly: false });

  if (validationResult.error) {
    const errors = [];

    for (let i = 0; i < validationResult.error.details.length; i++) {
      errors.push(validationResult.error.details[i].message);
    }

    return response.status(400).send(errors).end();
  } else {
    return next();
  }
}

const updateUserAvatar = (request, response) => {
  const { avatar } = request.body
  const token = request.headers.authorization.split(' ')[1];

  jwt.verify(token, sessionsController.privateKey, function (err, decoded) {
    if (!decoded) {
      return response.status(400).send([err]).end();
    }

    server.query(
      'SELECT * FROM users WHERE id = $1',
      [decoded.id],
      (error, results) => {
        if (error) {
          throw error
        }

        server.query(
          'UPDATE users SET avatar = $1 WHERE id = $2',
          [avatar, decoded.id],
          (error, results) => {
            if (error) {
              throw error
            }
            response.status(200).send({ msg: 'success' });
          });
      }
    )

  });
}

async function validateSendBugReport(request, response, next) {
  const validationResult = Joi.validate(request.body, sendBugReportParams, { abortEarly: false });

  if (validationResult.error) {
    const errors = [];

    for (let i = 0; i < validationResult.error.details.length; i++) {
      errors.push(validationResult.error.details[i].message);
    }

    return response.status(400).send(errors).end();
  } else {
    return next();
  }
}

const sendBugReport = (request, response) => {
  const { message } = request.body

  const token = request.headers.authorization.split(' ')[1];
  jwt.verify(token, sessionsController.privateKey, function (err, decoded) {
    if (!decoded) {
      return response.status(400).send([err]).end();
    }

    let transport = nodemailer.createTransport({
      service: "hotmail",
      auth: {
        user: "thechump@hotmail.com",
        pass: "veilofcloud222"
      }
    });

    const email = {
      from: 'thechump@hotmail.com',
      to: 'nepexx@gmail.com',
      subject: 'Prate Bug Report',
      text: message
    };
    transport.sendMail(email, function (err, info) {
      if (err) {
        return response.status(400).send({ msg: 'error' }).end();
      } else {
        response.status(200).send({ msg: 'success' });
      }
    });
  });
}

const deleteUser = (request, response) => {
  const id = parseInt(request.params.id)

  server.query('DELETE FROM users WHERE id = $1', [id], (error, results) => {
    if (error) {
      throw error
    }
    response.status(200).send(`User deleted with ID: ${id}`);
  })
}


module.exports = {
  getUsers: getUsers,
  getUser: getUser,
  validateCreateUser: validateCreateUser,
  createUser: createUser,
  validateUpdateUser: validateUpdateUser,
  validateUpdateUserAvatar: validateUpdateUserAvatar,
  updateUserAvatar: updateUserAvatar,
  updateUser: updateUser,
  deleteUser: deleteUser,
  validateSendBugReport: validateSendBugReport,
  sendBugReport: sendBugReport
}