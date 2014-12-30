/* global require, console */

'use strict';

var q = require('q');
var os = require('os');
var fs = require('fs');
var R = require('ramda');
var _ = require('underscore');
var log = require('koast-logger');
var express = require('express');
var request = require('request');
var uuid = require('uuid');

var mds = require('mongodump-stream');
var MongoClient = require('mongodb').MongoClient;

var backup = require('./backup/backup');
var backup_handlers = require('./backup/handlers');

var apiFactory = require('./api-factory');
var backupHandlers = require('./backup/handlers');
var Rutil = require('./../util/Rutil');

var constants = { //Saneth defaults
  backupCollection: 'backups'
};

//Returns a promise which resolves to the admin router

function generateAdminRouter(conf) {
  var awsKey = conf.aws.key;
  var awsSecret = conf.aws.secret;

  var api = apiFactory(log);
  var p = q.defer();

  // Register backup handlers:

  backup.registerHandler('s3', backup_handlers.genS3BackupHandler(
        awsKey,
        awsSecret
  ));

  MongoClient.connect(conf.database.url, function(err, db) {
    if(err) {
      p.reject(err); 
      return;
    }

    var backupCollection = db.collection(constants.backupCollection);
    var liveBackups = {};
    
    //Lists all persisted backups 
    api.register('backup', 'list', 'GET', function() {
        var results = backupCollection.find({}, {_id:0, backupId:1, type:1});
        return q.nbind(results.toArray, results)();
    });

    api.register('backup', 'stat', 'GET', [ 'id' ], function(id) {
      if(liveBackups[id]) {
        return q(liveBackups[id]);
      }

      return q.nbind(backupCollection.findOne, backupCollection)({ backupId: id })
        .then(function(r) {
          if(!r) {
            return q({ "error": true, msg: 'backup with id ' + id + ' not found'});
          }

          return q({ 'status': 'saved' });
        });
    });
 
    //Request object must be of the form 
    //  { 
    //    collections: [<String>],
    //    type: <String>,
    //    opts: <Object>
    //  }

    api.register('backup', 'create', 'POST', function(args) {
      var id = uuid.v1();
      liveBackups[id] = { 'status': 'inprogress' };
      args.opts.key = args.opts.key || args.collections.concat([new Date().getTime()]).join('-');
      backup.create(conf.backups.target, args.collections, args.type, args.opts)
        .then(function(backupRecord) {
          backupRecord.backupId = id;
          backupCollection.insert(backupRecord, function(e) {
            if(e) {
              liveBackups[id] = { 'status': 'failed' };
              log.error(e);
            }
            delete liveBackups[id];
          });
        })
        .then(null, log.error.bind(log));

      return q({id: id});
    });

    
    //FIXME use tickets to manage restore ops (similar to backups)
    
    api.register('backup', 'restore', 'POST', function(args) {
      var id = args.id;
      return q.nbind(backupCollection.findOne, backupCollection)({ backupId: id })
        .then(function(r) {
          if(!r) {
            return q({ error: true, msg: 'backup with id ' + id + ' not found ' });
          }
          return backup.restore(r, conf.backups.target);
        });
    });

    p.resolve(api.getApp());
  });
  return p.promise;
}

exports.genKoastModule = function(config) {
  return {
    router:  generateAdminRouter(config),
    defaults: {} 
  };
};
