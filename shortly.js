var express = require('express');
var session = require('express-session');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
//add sessions
//app.use(express.cookieParser('secret'));  //don't need this line with Express 4. 
app.use(session({secret: 'keyboard cat'}));

var inputUsername;
var inputPassword;
var salt;
var hash;


//exports.createSession = function(req, res, newUser) {
//   return req.session.regenerate(function() {
//     req.session.user = newUser;
//     res.redirect('/');
//   });
// };

// exports.isLoggedIn = function(req, res) {
//   return req.session ? !! req.session.user : false; 
// };

var restrict = function(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    // req.session.error = 'DENIED!';
    res.redirect('/login');
  }
};

// var saveNewUser = function(req, res) {
//   console.log('saving new user')
//   var user = new User({
//     username: inputUsername,
//     password: inputPassword
//   });

//   user.save().then(function(newUser) {
//     Users.add(newUser);
//     console.log('newuser saved');
//     console.log(user)
//     req.session.regenerate(function() {
//       req.session.user = user.username;
//       res.redirect('/');
//     });
//   });
// };
app.get('/', restrict, function(req, res) {  //third arg to app.get is success function. when 
   res.render('index');                       //restrict is invoked, have access to original function. 
});

app.get('/create', restrict, function(req, res) {
  res.render('index');
});

app.get('/login', function(req, res) {
  res.render('login');
});

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.get('/links', restrict, function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

app.post('/signup', function(req, res) {
  inputUsername = req.body.username;
  inputPassword = req.body.password;
  // console.log(inputUsername, inputPassword)

  new User({username: inputUsername}).fetch().then(function(found) {
    if (found) {
      console.log("That username is taken.");
      res.redirect('/signup');
    } else {
      // console.log('at else')
      // saveNewUser(req, res);
      // console.log('saving new user')
      // salt = bcrypt.genSaltSync(1);
      // hash = bcrypt.hashSync(inputPassword, salt);
      bcrypt.hash(inputPassword, null, null, function(err, hash) {
        Users.create({
          username: inputUsername,
          password: hash
        }).then(function(user) {
          //log them in
          req.session.regenerate(function() {
            req.session.user = user.attributes.username;
            res.redirect('/');
          })
    //   })
    //   var user = new User({
    //   username: inputUsername,
    //   password: hash
    // });
    // user.save().then(function(newUser) {
    // Users.add(newUser);

  //bcrypt.hash(arg, null(autogenerate salt), null(number of interations), function(err, hash))
//Users.create does implicit save and add.  Just alternate syntax. 
    });
  });
    }
  })
});
//better to put hashing stuff in user model, so that there's not unneccessary internation between
//app and model.  Dependency going in wrong direction.  


app.post('/login', function(req, res) {
  inputUsername = req.body.username;
  salt = bcrypt.genSaltSync(1);
  inputPassword = bcrypt.hashSync(req.body.password, salt);
  console.log(inputPassword)

  new User({'username': inputUsername}).fetch().then(function(model) {
    console.log(model, 'whole model')
    if (!model) {
      //if user doesn't exist yet, send back to login
      res.redirect('/login');
    } else if (model.attributes.password === inputPassword) {
      console.log('logging you in');
      req.session.regenerate(function() {
        req.session.user = model.attributes.username;
        res.redirect('/');
        //bcrypt.compare(inputPassword, model.get('password'), function(match) {
          // if (match) {
          // util.createSession(req, res, user);  //Fred has this in util file, need to fix syntax above
          //   res.redirect('/')
          // } else {
          //   res.redirect('/login');
          // }
        })//use bcrypt.hash above to use bcrypt.compare here
      });


    } else {
      console.log(model.attributes.username, model.attributes.password, 'model');
      console.log(inputUsername, inputPassword);
      console.log('Wrong username or password.');
      res.redirect('/signup');
    }
  })
});

app.get('/logout', function(req, res){
  req.session.destroy(function() {
    res.redirect('/');
  });
});


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
