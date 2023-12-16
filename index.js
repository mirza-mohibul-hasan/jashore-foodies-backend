const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// Middleware
app.use(cors());
app.use(express.json());
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
            return res.status(403).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}

// Mongo start here
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vlpkg6s.mongodb.net/?retryWrites=true&w=majority`;
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
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        /* Working Zone Start */
        // Collections
        const usersCollection = client.db("jashoreFoodiesDB").collection("users");
        const restaurantsCollection = client.db("jashoreFoodiesDB").collection("restaurants");
        const restaurantFeedbackCollection = client.db("jashoreFoodiesDB").collection("authorityrestaurantfeedback");
        const adminsCollection = client.db("jashoreFoodiesDB").collection("admins");
        // Restaurant
        const itemsCollection = client.db("jashoreFoodiesDB").collection("fooditems");
        const tableCollection = client.db("jashoreFoodiesDB").collection("restauranttables");

        // JWT Token
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })
        /* Common API*/
        app.get('/role/:email', async (req, res) => {
            const email = req?.params?.email;
            const query = { email: email }
            const restaurant = await restaurantsCollection.findOne(query);
            const user = await usersCollection.findOne(query);
            const admin = await adminsCollection.findOne(query);
            const result = { isCustomer: user?.role === 'customer', isAdmin: admin?.role === 'admin', isRestaurant: restaurant?.role === 'restaurant' }
            res.send(result);
        })
        // Table Reservation Page
        app.get("/tablereservation", async (req, res) => {
            const result = await tableCollection.find().toArray()
            res.send(result)
        })
        // restaurantdetails
        app.get("/restaurantdetails/:email", async (req, res) => {
            const email = req.params.email;
            const result = await restaurantsCollection.findOne({ email: email })
            res.send(result);
        })
        app.get("/restaurantdetailswi/:restaurantId", async (req, res) => {
            const restaurantId = req.params.restaurantId;
            const result = await restaurantsCollection.findOne({ _id: new ObjectId(restaurantId) })
            res.send(result);
        })

        /* Customer Related API*/
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const exists = await usersCollection.findOne(query);
            if (exists) {
                return res.send({ message: 'already exists' })
            }
            const result = await usersCollection.insertOne(user);
            // console.log(result)
            res.send(result);
        });

        /* Restaurant Related API */
        // Restaurant register
        app.post('/restaurants', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const exists = await restaurantsCollection.findOne(query);
            if (exists) {
                return res.send({ message: 'already exists' })
            }
            const result = await restaurantsCollection.insertOne(user);
            res.send(result);
        });
        // check restaurant approval
        app.get('/isrestaurantapproved/:email', async (req, res) => {
            const email = req?.params?.email;
            const query = { email: email }
            const restaurant = await restaurantsCollection.findOne(query);
            const result = restaurant?.status === 'approved'
            res.send(result);
        })
        // Add New Table
        app.post("/addtable", async (req, res) => {
            const newTable = req.body;
            const result = await tableCollection.insertOne(newTable)
            res.send(result)
        })
        // My Tables
        app.get("/mytables/:email", async (req, res) => {
            const result = await tableCollection.find({ restaurantEmail: req.params.email }).toArray();
            res.send(result)
        })
        // My Items
        app.get("/myitems/:email", async (req, res) => {
            const result = await itemsCollection.find({ restaurantEmail: req.params.email }).toArray();
            res.send(result)
        })
        // Add New item
        app.post("/additem", async (req, res) => {
            const newItem = req.body;
            const result = await itemsCollection.insertOne(newItem)
            res.send(result)
            // console.log(newItem);
        })
        /* Admin Related Api */
        app.get('/pendingrestaurnt', async (req, res) => {
            const query = { status: "pending" }
            const result = await restaurantsCollection.find(query).toArray();
            // console.log(result)
            res.send(result)
        })
        app.post('/approverestaurant/:id', async (req, res) => {
            const id = req.params.id;
            const message = req.body.message;
            const newfeedback = { restaurantId: id, message }
            const query = { _id: new ObjectId(id) }

            const feedback = await restaurantFeedbackCollection.insertOne(newfeedback)
            const updateDoc = {
                $set: {
                    status: "approved"
                },
            };
            const restaurant = await restaurantsCollection.updateOne(query, updateDoc)
            const acknowledged = { acknowledged: feedback.acknowledged && restaurant.acknowledged }
            console.log(acknowledged)
            res.send(acknowledged);

        })
        // app.post('/adminfeedback', async(req, res)=>{
        //     const query = {status: "pending"}
        //     const result = await restaurantsCollection.find(query).toArray();
        //     res.send(result)
        // })

        // Home page info
        app.get('/adminhomeinfo', async (req, res) => {
            const query = { status: "pending" }
            const result = await restaurantsCollection.find(query).toArray();
            const info = { newreq: result.length }
            res.send(info)
        })
        /* Working Zone End */
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        /* await client.close(); */
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send("Jashore Foodies is currently running")
})
app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})