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
app.use(session({secret: 'keyboard cat'}));

var inputUsername;
var inputPassword;
var salt;
var hash;

app.get('/', util.restrict, function(req, res) {  //third arg to app.get is success function. when
   res.render('index');                       //util.restrict is invoked, have access to original function.
});

app.get('/create', util.restrict, function(req, res) {
  res.render('index');
});

app.get('/login', function(req, res) {
  res.render('login');
});

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.get('/links', util.restrict, function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.get('/logout', function(req, res){
  req.session.destroy(function() {
    res.redirect('/');
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

  new User({username: inputUsername}).fetch().then(function(found) {
    if (found) {
      console.log("That username is taken.");
      res.redirect('/signup');
    } else {
        Users.create({
          username: inputUsername,
          password: inputPassword
        }).then(function(user) {
          //log them in
          util.createSession(req, res, user)
        })
    }
  });
});

app.post('/login', function(req, res) {
  inputUsername = req.body.username;
  inputPassword = req.body.password;
  console.log("input password is: ", inputPassword)

  new User({'username': inputUsername}).fetch().then(function(model) {
    if (!model) {
      //if user doesn't exist yet, send back to login
      res.redirect('/login');
    } else {
      console.log('input pw: ', inputPassword, 'fetched: ', model.get('password'))
      bcrypt.compare(inputPassword, model.get('password'), function(err, match) {
        if (match) {
          console.log('match true');
          util.createSession(req, res, model);
        } else {
          console.log('match false')
          res.redirect('/login');
        }
      });
      }
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
