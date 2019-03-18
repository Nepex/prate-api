const server = require('../../connection.js');

async function checkEmailExists(email) {
    return new Promise(function (resolve, reject) {
        server.query('SELECT * FROM users WHERE email = $1', [email], (error, results) => {
            if (error) {
                throw error
            }

            const rows = results.rows;

            if (rows.length > 0) {
                resolve(true);
            }

            resolve(false);
        })
    });
}

module.exports = {
    checkEmailExists: checkEmailExists
};