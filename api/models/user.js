const server = require('../../connection.js');
const bcrypt = require('bcrypt');

async function checkEmailExists(email) {
    return new Promise(function (resolve, reject) {
        server.query('SELECT * FROM users WHERE email = $1', [email], (error, results) => {
            if (error) {
                return response.status(400).send(['Error loading data']);
            }

            const rows = results.rows;

            if (rows.length > 0) {
                resolve(true);
            }

            resolve(false);
        })
    });
}

async function checkPasswordCorrect(id, password) {
    return new Promise(function (resolve, reject) {
        server.query('SELECT * FROM users WHERE id = $1', [id], (error, results) => {
            if (error) {
                return response.status(400).send(['Error loading data']);
            }

            bcrypt.compare(password, results.rows[0].password, function (err, res) {
                if (res) {
                    resolve(true);
                } else {
                    reject(false);
                }
            });

        })
    });
}

module.exports = {
    checkEmailExists: checkEmailExists,
    checkPasswordCorrect: checkPasswordCorrect
};