const express = require('express'),
    pouchdb = require('pouchdb'),
    passport = require('passport'),
    bodyParser = require('body-parser'),
    sessions = require('express-session'),
    LocalStrategy = require('passport-local').Strategy,
    flash = require('connect-flash');

pouchdb.plugin(require('pouchdb-upsert'));

const db = new pouchdb('my_db');
const app = express();
let User = [];

db.get('users').catch(function (err) {
    if (err.name === 'not_found') {
        return {
            _id: 'users',
            users: []
        };
    } else { // hm, some other error
        throw err;
    }
}).then(function (doc) {
   User = doc.users;
}).catch(err => {
    console.log(err);
});

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(sessions({secret: '{secret}', name: 'session_id', saveUninitialized: true, resave: true}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.get('/', function(request, response) {
    response.sendFile(__dirname + '/views/login.html');
});

app.get('/index', function (request, response) {
   response.sendFile(__dirname + '/views/index.html');
});

app.get('/getNames', function (req, res) {
    req.session.names = [];
    db.get(req.session.passport.user).catch(err => {
        console.log(err);
    }).then(doc => {
        let names;
        if (doc.names) {
            names = doc.names;
        } else {
            names = [];
        }
        names.forEach(entry => {
            req.session.names.push(entry.name);
        });
        res.status(200).send(req.session.name);
    }).catch(err => {
        console.log(err);
    });
});

app.post('/addName', function (req, res) {
   const body = req.body;
   const session = req.session;
   let names = [];
   db.get(session.passport.user).catch(err => {
       console.log(err);
   }).then(doc => {
       names = doc.names || [];
       if (session.names) {
           const name = session.names.find(name => name === body.name);
           if (!name) {
               names.push(body);
               session.names.push(body.name);
               db.upsert(session.passport.user, function(doc) {
                   doc.counter = doc.counter || 0;
                   doc.counter++;
                   doc.names = names;
                   return doc;
               }).catch(err => {
                   console.log(err);
               })
           } else {
               names.forEach((entry, index) => {
                   if (entry.name === body.name) {
                       names[index] = body;
                   }});
               db.upsert(session.passport.user, function(doc) {
                   doc.counter = doc.counter || 0;
                   doc.counter++;
                   doc.names = names;
                   return doc;
               }).catch(err => {
                   console.log(err);
               })
           }
       }
       res.status(200).send(req.session.names);
   }).catch(err => {
       console.log(err);
   });
});

app.post('/register', function (req, res) {
    let newUser = req.body;
    const user1 = User.find(user => user.username === newUser.newUsername);
    if (!user1) {
        newUser = {
            username: newUser.newUsername,
            password: newUser.newPassword,
        };
        User.push(newUser);
        let userDoc = {
            _id: 'users',
            users: User
        };
        db.upsert('users', function (doc) {
            doc.counter = doc.counter || 0;
            doc.counter++;
            doc.users = User;
            return doc;
        }).catch(err => {
            console.log(err);
        });
    }
    res.sendFile(__dirname + '/views/login.html');
});

app.post('/login',
    passport.authenticate('local', { successRedirect: '/index',
        failureRedirect: '/', failureFlash: 'Invalid Username or Password' }));

const listener = app.listen(3000, function() {
    console.log('Your app is listening on port ' + 3000);
});

passport.use(new LocalStrategy(
    function(username, password, done) {
        const user1 = User.find(user => user.username === username);

        if (!user1) {
            return done(null, false, {message: "Incorrect user"});
        } else if (user1.password === password) {
            return done(null, {username, password});
        } else {
            return done(null, false, {message: "Incorrect password"});
        }
    }
));

passport.serializeUser( ( user, done ) => done( null, user.username ) );

passport.deserializeUser( ( username, done ) => {
    const user = User.find( u => u.username === username );
    console.log( 'deserializing:', username );

    if( user !== undefined ) {
        done( null, user )
    }else{
        done( null, false, { message:'user not found; session not restored' })
    }
});
