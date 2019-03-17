const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const port = 3000

app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
)

// register routes
require('./api/controllers/routes')(app);

app.listen(port, () => {
  console.log(`App running on port ${port}.`)
})