const Pool = require('pg').Pool

module.exports = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'prate',
  // password: 'averysecurepassword2@2',
  password: 'root',
  port: 5432,
});