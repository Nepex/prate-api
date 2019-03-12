const Pool = require('pg').Pool

module.exports = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'prate',
  password: 'postgres',
  port: 5432,
});