/** @module lib/authentication/password */
/* globals require, exports */
'use strict';

// Includes password reset, change password given token
// Depends on config/<env>/mailer-reset.json and config/<env>/mailer-password-changed.json

var passport = require('passport');
var bcrypt = require('bcrypt');
var Q = require('q');
var expect = require('chai').expect;
var LocalStrategy = require('passport-local').Strategy;
var log = require('../log');

var async = require('async');
var crypto = require('crypto');
var mailerMaker = require('../mailer').mailerMaker;
var authentication = require('./authentication');

var SALT_WORK_FACTOR = 10;

/**
 * Give a user object and password, save the user to the database
 * with an encryped password.
 *
 * Returns a promise which will be resolved if the user was succesfully saved
 * or rejected if an error occured.
 *
 * @function saveUser
 * @param {Object} user TODO
 * @param {String} password TODO
 */
exports.saveUser = function(user, password) {
  var deferred = Q.defer();

  // Encrypt the password
  SALT_WORK_FACTOR = 10;
  bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
    if (err) {
      log.error('Could not generate salt.');
      return deferred.reject(err);
    }

    // Hash the password using our new salt
    bcrypt.hash(password, salt, function(err, hash) {
      if (err) {
        log.error('Could not hash password');
        return deferred.reject(err);
      }

      user.password = hash;

      // Save the user
      user.save(function(err, user) {
        if (user) {
          log.verbose(user.username + ' was saved to the database');
          deferred.resolve(user);
        } else if (err) {
          return deferred.reject(err);
        }
      });

    });
  });

  return deferred.promise;
};

function comparePasswords(password1, password2) {
  var deferred = Q.defer();
  bcrypt.compare(password1, password2, deferred.makeNodeResolver());
  return deferred.promise;
}

function makeHandlers (done) {
  return {
    reject: function (message) {
      done(null, false, {
        message: 'No such user or wrong password.'
      });
    },
    accept: function (user) {
      done(null, user);
    },
    reportError: function (error) {
      log.error(error);
      log.error(error.stack);
      done(error, false, {
        message: 'Sorry something went wrong. Please try again later.'
      });
    }
  };
}

function makeVerifyFunction (users, config) {
  return function verify(username, password, done) {
    log.debug('Verifying:', username, password);
    var userQuery = {
      username: username
    };
    var handlers = makeHandlers(done);
    users.findOne(userQuery).exec()
      .then(function(user) {
        if (!user){
          done(null, false); // reject
          return;
        }

        user = user.toObject();
        log.debug('found:', user);
        if (!user) {
          done(null, false); // reject
        } else {
          expect(user.username).to.equal(username);
          log.debug('passport.localStrategy: found user %s.', username);
          return comparePasswords(password, user.password)
            .then(function(accept) {
              done(null, accept && user); // accept
            });
        }
      })
      .then(null, done); // report error
  };
}

function handleErrorOrSuccess(err, result, response) {
  if (err) { 
    log.error(err);
    return response.send(500, err); 
  }
  log.info('success ' + result);
  return response.send(200, result);
}

/**
 * TODO
 *
 * @function setup
 * @param {TODO} app TODO
 * @param {TODO} users TODO
 * @param {TODO} config TODO
 */
exports.setup = function(app, users, config) {

  // Used for mailing out that the user has RESET his password
  var mailerReset = mailerMaker('mailer-reset');

  // Used for mailing out that the user has CHANGED his password
  var mailerPasswordChanged = mailerMaker('mailer-password-changed');


  // Setup the authentication strategy
  var strategy = new LocalStrategy(makeVerifyFunction(users, config));
  passport.use(strategy);
  // Setup a route using that strategy
  app.post('/auth/login', function(req, res, next) {
    passport.authenticate('local', function(err, user, info) {
      if (err) {
        return next(err);
      }
      config.callback(user, req, res, next);
    })(req, res, next);
  });

  // Reset the password and provide a token to the user via email
  app.post('/forgot', function(req, res) {
    async.waterfall([

      function(done) {
        // Generate token
        crypto.randomBytes(20, function(err, buf) {
          var token = buf.toString('hex');
          done(err, token);
        });
      },
      function(token, done) {
        // Find user and set token and token expiry date
        users.findOne({
          email: req.body.email
        }, function(err, user) {
          if (!user) {
            var errMsg = 'No account with that email address exists.';
            log.error(errMsg);
            return res.send(422, errMsg);
          }

          user.resetPasswordToken = token;
          user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
          user.save(function(err) {
            done(err, token, user);
          });
        });
      },
      function(token, user, done) {
        // Send email
        var mail = mailerReset.initEmail()
          .then(function(mail){

            // Replace {token} with actual token in the mail's message. 
            // The message must have {token} in either mail.html or mail.text
            if (mail.text){
              expect(mail.text.indexOf('{token}') < 0).to.equal(false);
              mail.text = mail.text.replace('{token}', token);
            } else if (mail.html){
              expect(mail.html.indexOf('{token}') < 0).to.equal(false);  
              mail.html = mail.html.replace('{token}', token);
            }
            
            mail.to = user.email;

            mailerReset.sendMail(mail, function(err, result) {
              if (!err){
                log.info('An e-mail has been sent to ' + user.email + ' with reset password instructions.');
              }
              done(err, 'done');
            });
          }, function(err){
            done(err);
          });

      }
    ], function(err, result) { handleErrorOrSuccess(err, result, res); }
    );
  });


  function _findUserWithToken(token, cb) {
    users.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: {
        $gt: Date.now()
      }
    }, cb);
  }

  // Simple check to see if token is valid (used for remote client apps)
  app.get('/reset/:token', function(req, res) {
    _findUserWithToken(req.params.token, function(err, user) {
      if (!user) {
        return res.send(422, 'Password reset token is invalid or has expired.');
      } else {
        return res.send(200, {});
      }
    });
  });

  // Given a valid token, reset the password with a new password (encrypted), and email the user of such change.
  app.post('/reset/:token', function(req, res) {
    async.waterfall([

      function(done) {
        _findUserWithToken(req.params.token, function(err, user) {
          if (!user) {
            return res.send(401, 'Password reset token is invalid or has expired.');
          }

          user.resetPasswordToken = undefined;
          user.resetPasswordExpires = undefined;
          exports.saveUser(user, req.body.password)
            .then(function(userResult) {
              done(null, userResult);
            }, function(err) {
              done(err);
            });
        });
      },
      function (user, done) {
        var mail = mailerPasswordChanged.initEmail()
          .then(function (mail) {
            mail.to = user.email;

            mailerPasswordChanged.sendMail(mail, function (err, result) {
              log.info('An e-mail has been sent to ' + user.email + ' indicating successful password change.');
              done(err, 'done');
            });
          }, function (err) {
            done(err);
          });


      }
    ], function(err, result) {
      handleErrorOrSuccess(err, result, res);
    });
  });
};
