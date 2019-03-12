const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const port = 3000

const usersController = require('./api/controllers/usersController.js');

app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
)

app.listen(port, () => {
  console.log(`App running on port ${port}.`)
})

// users
app.get('/users', usersController.getUsers)
app.get('/users/:id', usersController.getUserById)
app.post('/users', usersController.createUser)
app.put('/users/:id', usersController.updateUser)
app.delete('/users/:id', usersController.deleteUser)
