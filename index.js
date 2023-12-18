const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// SSL
const SSLCommerzPayment = require('sslcommerz-lts')
const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false //true for live, false for sandbox
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
        const db = client.db("jashoreFoodiesDB")
        const usersCollection = db.collection("users");
        const restaurantsCollection = db.collection("restaurants");
        const restaurantFeedbackCollection = db.collection("authorityrestaurantfeedback");
        const adminsCollection = db.collection("admins");
        // Restaurant
        const itemsCollection = db.collection("fooditems");
        const tableCollection = db.collection("restauranttables");
        // Reservations
        const currentReservationCollection = db.collection("currentreservation")
        const reservationHistoryCollection = db.collection("reservationhistory")
        // Payments
        const reservationspaymentsCollection = db.collection("reservationspayments");
        const userPaymenthistoryCollection = db.collection("userpaymenthistory");
        const restaurantPaymentHistoryCollection = db.collection("restaurantpaymenthistory");

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
            res.send(result);
        });
        // Table Details for Payment Page
        app.get("/tabledetails/:tableId", async (req, res) => {
            const tableId = req.params.tableId;
            const result = await tableCollection.findOne({ _id: new ObjectId(tableId) })
            res.send(result);
        })
        // Customer Details for Payment Page
        app.get("/customerdetails/:userEmail", async (req, res) => {
            const userEmail = req.params.userEmail;
            const result = await usersCollection.findOne({ email: userEmail })
            res.send(result);
        })
        // my reservations
        app.get("/myreservations/:customerEmail", async (req, res) => {
            const customerEmail = req.params.customerEmail;
            const result = await currentReservationCollection.find({ customerEmail: customerEmail }).toArray();
            res.send(result);
        })
        // payment history
        app.get("/paymenthistory/:userEmail", async (req, res) => {
            const userEmail = req.params.userEmail;
            const result = await reservationspaymentsCollection.find({ customerEmail: userEmail }).toArray();
            res.send(result);
        })

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
        /* SSL Commerz */
        // For Table Reservations
        const tran_id = new ObjectId().toString();
        app.post("/reservepayment", async (req, res) => {
            // console.log(req.body);
            const info = req.body;
            const table = info.table;
            table.price = parseFloat(table.price)
            const customer = info.customer;
            const data = {
                total_amount: (table?.price * .50).toFixed(2),
                currency: info.currency,
                tran_id: tran_id, // use unique tran_id for each api call
                success_url: `http://localhost:3000/reservationpayment/success/${tran_id}`,
                fail_url: `http://localhost:3000/reservationpayment/failed/${tran_id}`,
                cancel_url: 'http://localhost:3030/cancel',
                ipn_url: 'http://localhost:3030/ipn',
                shipping_method: 'Courier',
                product_name: 'Restaurant Table.',
                product_category: table.shape,
                product_profile: 'general',
                cus_name: info.name,
                cus_email: customer.email,
                cus_add1: info.address,
                cus_add2: 'Dhaka',
                cus_city: 'Dhaka',
                cus_state: 'Dhaka',
                cus_postcode: info.postcode,
                cus_country: 'Bangladesh',
                cus_phone: info.phone,
                cus_fax: '01711111111',
                ship_name: 'Customer Name',
                ship_add1: 'Dhaka',
                ship_add2: 'Dhaka',
                ship_city: 'Dhaka',
                ship_state: 'Dhaka',
                ship_postcode: 1000,
                ship_country: 'Bangladesh',
            };
            // console.log(info)
            const newCurrentReservation = {
                customerId: customer._id,
                customerEmail: customer.email,
                customerName: info.name,
                customerContact: info.phone,
                table,
                restaurantEmail: table.restaurantEmail,
                time: new Date()
            }
            const newUserPaymentHistory = {
                tranId: tran_id,
                currency: info.currency,
                itemType: "table",
                amount: (table?.price * .50).toFixed(2),
                table,
                restaurantEmail: table.restaurantEmail,
                table,
                time: new Date()
            }
            const newRestaurantPaymentHistory = {
                tranId: tran_id,
                currency: info.currency,
                itemType: "table",
                customerEmail: customer.email,
                customerName: info.name,
                amount: (table?.price * .50).toFixed(2),
                table,
                restaurantEmail: table.restaurantEmail,
                restaurantId: table.restaurantId,
                restaurantName: table.restaurantName,
                time: new Date()
            }
            // console.log(newCurrentReservation)
            // console.log(newUserPaymentHistory)
            // console.log(newRestaurantPaymentHistory)

            const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
            sslcz.init(data).then(apiResponse => {
                // Redirect the user to payment gateway
                let GatewayPageURL = apiResponse.GatewayPageURL
                // res.redirect(GatewayPageURL)
                res.send({ url: GatewayPageURL });

                // Transaction Info for user
                const paymentInfo = {
                    paymentStatus: false,
                    amount: parseFloat(table?.price) * .50.toFixed(2),
                    transactionId: tran_id,
                    tableId: table._id,
                    restaurantEmail: table.restaurantEmail,
                    restaurantName: table.restaurantName,
                    customerId: customer._id,
                    customerEmail: customer.email,
                    customerName: customer.name
                }
                const result = reservationspaymentsCollection.insertOne(paymentInfo)

                console.log('Redirecting to: ', GatewayPageURL)
            });
            app.post("/reservationpayment/success/:tranId", async (req, res) => {
                // console.log(req.params.tranId);
                const result = await reservationspaymentsCollection.updateOne({ transactionId: req.params.tranId }, {
                    $set: {
                        paymentStatus: true
                    }
                })
                if (result.modifiedCount > 0) {
                    currentReservationCollection.insertOne(newCurrentReservation);
                    userPaymenthistoryCollection.insertOne(newUserPaymentHistory)
                    restaurantPaymentHistoryCollection.insertOne(newRestaurantPaymentHistory)
                    reservationHistoryCollection.insertOne(newCurrentReservation)
                    tableCollection.updateOne({ _id: new ObjectId(table._id) }, {
                        $set: {
                            availability: false
                        }
                    })
                    res.redirect(`http://localhost:5173/payment/success/${req.params.tranId}`)
                }
            })
            app.post("/reservationpayment/failed/:tranId", async (req, res) => {
                // console.log(req.params.tranId);
                const result = await reservationspaymentsCollection.deleteOne({ transactionId: req.params.tranId })
                if (result.deletedCount > 0) {
                    res.redirect(`http://localhost:5173/payment/failed/${req.params.tranId}`)
                }
            })
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