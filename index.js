require('dotenv').config();
const express = require('express');
const cors = require('cors');
// payment 
const SSLCommerzPayment = require('sslcommerz-lts')
// // jwt
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;

// middleware 
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2a9l2qr.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// payment 
const store_id = process.env.Store_ID;
const store_passwd = process.env.Store_PASS;
const is_live = false //true for live, false for sandbox

// jwt verify start 
const verifyJwt = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' })
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}
// jwt verify end


async function run() {
  try {

    // server link start
    const serverCollection = client.db('dbAssignment12').collection('cltAssignment12');
    const selectedCollection = client.db('dbAssignment12').collection('selected');
    const usersCollection = client.db('dbAssignment12').collection('users');
    const ordersCollection = client.db('dbAssignment12').collection('orders');
    // server link end 

    // jwt localhost start
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1d'
      });
      res.send({ token });
    })
    // jwt localhost end

    // Warning: use verifyJWT before using verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    // Warning: use verifyJWT before using verifyInstructors
    const verifyInstructors = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'Instructors') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    // class added post mongoDB start
    app.post('/class', verifyJwt, verifyInstructors, async (req, res) => {
      const newAdd = req.body;
      const result = await serverCollection.insertOne(newAdd)
      res.send(result);
    });
    // class added post mongoDB end

    // get class data server start
    app.get('/class', async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      const result = await serverCollection.find(query).toArray();
      res.send(result);
    })
    //  get class data server end 

    //  class data patch start 
    app.patch('/class/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedClasses = req.body;

      const updateDoc = {
        $set: {
          status: updatedClasses.status
        }
      }
      const result = await serverCollection.updateOne(filter, updateDoc)
      res.send(result)
    })
    //  class data patch end

    // selected data added post mongoDB start
    app.post('/selected', async (req, res) => {
      const newAdd = req.body;
      const result = await selectedCollection.insertOne(newAdd)
      res.send(result);
    });
    // selected data added post mongoDB end

    // selected data added get mongoDB start
    app.get('/selected', async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      const result = await selectedCollection.find(query).toArray();
      res.send(result);
    })
    // selected data added get mongoDB end

    // selected data delete mongoDB start
    app.delete('/selected/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await selectedCollection.deleteOne(query);
      res.send(result);
    })
    // selected data delete mongoDB  exit

    // class order post mongoDB start
    const tran_id = new ObjectId().toString();
    app.post('/order', async (req, res) => {
      const order = req.body
      const product = await selectedCollection.findOne({
        _id: new ObjectId(order.productId)
      })

      const data = {
        total_amount: product?.price,
        currency: order?.category,
        tran_id: tran_id, // use unique tran_id for each api call
        success_url: `https://assignment12-server-site.vercel.app/payment/success/${tran_id}`,
        fail_url: `https://assignment12-server-site.vercel.app/payment/fail/${tran_id}`,
        cancel_url: 'http://localhost:3030/cancel',
        ipn_url: 'http://localhost:3030/ipn',
        shipping_method: 'Courier',
        product_name: product?.name,
        product_category: 'Electronic',
        product_profile: 'general',
        cus_name: order?.name,
        cus_email: order?.email,
        cus_add1: order?.address,
        cus_add2: 'Dhaka',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: order?.number,
        cus_fax: '01711111111',
        ship_name: 'Customer Name',
        ship_add1: 'Dhaka',
        ship_add2: 'Dhaka',
        ship_city: 'Dhaka',
        ship_state: 'Dhaka',
        ship_postcode: 1000,
        ship_country: 'Bangladesh',
      };
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
      sslcz.init(data).then(apiResponse => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL
        res.send({ url: GatewayPageURL })

        const finalOrder = {
          product,
          paidStatus: false,
          tranjectionId: tran_id,
        };
        const result = ordersCollection.insertOne(finalOrder)

        console.log('Redirecting to: ', GatewayPageURL)
      });

      app.post('/payment/success/:tranId', async (req, res) => {
        console.log(req.params.tranId);
        const result = await ordersCollection.updateOne(
          { tranjectionId: req.params.tranId },
          {
            $set: {
              paidStatus: true,
            },
          }
        );
        if (result.modifiedCount > 0) {
          res.redirect(
            `http://localhost:5173/dashboard/success/${req.params.tranId}`
          )
        }
      })
      app.post('/payment/fail/:tranId', async (req, res) => {
        console.log(req.params.tranId);
        const result = await ordersCollection.deleteOne({
          tranjectionId: req.params.tranId,
        });
        if (result.modifiedCount > 0) {
          res.redirect(
            `http://localhost:5173/dashboard/fail/${req.params.tranId}`
          )
        }
      })

    });
    // class order post mongoDB end

    // class order data  get mongoDB start
    app.get('/order', async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      const result = await ordersCollection.find(query).toArray();
      res.send(result);
    })
    // class order data get mongoDB end

    // user data post dataBD start 
    app.post('/users', async (req, res) => {
      const user = req.body;

      // google sign up part start
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }
      // google sign up part start

      const result = await usersCollection.insertOne(user)
      res.send(result);
    });
    // user data post dataBD exit

    // user data delete mongoDB start
    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    })
    // user data delete mongoDB  exit

    // admin user information get  start
    app.get('/users', async (req, res) => {
      const cursor = usersCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })
    // admin user information get end

    // user admin check start
    app.get('/users/admin/:email', verifyJwt, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      // jwt verifyJwt start
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      // jwt verifyJwt end

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })
    // user admin check end

    // user Instructors check start
    app.get('/users/Instructors/:email', verifyJwt, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ Instructors: false })
      }

      // jwt verifyJwt start
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      // jwt verifyJwt end

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { Instructors: user?.role === 'Instructors' }
      res.send(result);
    })
    // user Instructors check end

    // user admin role added start
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    // user admin role added exit

    // user Instructors role added start
    app.patch('/users/Instructors/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'Instructors'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    // user Instructors role added exit


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Music-School server running')
})

app.listen(port, () => {
  console.log(`server is running on port: ${port}`);
})

