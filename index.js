const express = require('express');
const cors = require('cors');
// // jwt
// const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();

// middleware 
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2a9l2qr.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    // server link start
    const serverCollection = client.db('dbAssignment12').collection('cltAssignment12');
    const usersCollection = client.db('dbAssignment12').collection('users');
    // server link end 


    // user information post dataBD start 
    app.post('/users', async (req, res) => {
      const user = req.body;

      // // google sign up part start
      // const query = { email: user.email }
      // const existingUser = await usersCollection.findOne(query);
      // if (existingUser) {
      //   return res.send({ message: 'user already exists' })
      // }
      // // google sign up part start

      const result = await usersCollection.insertOne(user)
      res.send(result);
    });
    // user information post dataBD exit


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Assignment12 server running')
})

app.listen(port, () => {
  console.log(`server is running on port: ${port}`);
})

