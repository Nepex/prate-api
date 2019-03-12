const Pool = require('pg').Pool
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'prate',
  password: 'postgres',
  port: 5432,
})
