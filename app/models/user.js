var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,

initialize: function(){
  this.on('creating', this.hashPassword);  //whenever we create new user object, first run hashPassword function
}, 

comparePassword: function(attemptedPassword, callback) {
  bcrypt.compare(attemptedPassword, this.get('password'), function(err, isMatch) {
    callback(isMatch);
  });
},

hashPassword: function() {
  var cipher = Promise.promisify(bcrypt.hash);
  //return promise - bookshelf will wait for promise to resolve before completing create action
  return cipher(this.get('password'), null, null)
    .bind(this)
    .then(function(hash) {
      this.set('password', hash);  //when we set password, need to have reference to context that existed
    });                             //above.  Could save or use bind. 
  }
});

module.exports = User;

//redirect has specific header with a location property.  
//cookie is another container object that stores whatever data the server decides to store about the client. 
