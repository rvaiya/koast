var express = require('express');
var q = require('q');
var bodyParser = require('body-parser');


// Returns an object which can be used to register endpoints and generate an
// express app with a discoverable api. The goal is to abstract away the
// request/response handling noise and allow one to conceptualize REST queries
// as simple method calls while simultaneously allowing for the construction of
// 'traditional' endpoints (ones which still respect HTTP verbs and have a
// notion of resources [hence the need for a type parameter]).
//
// register consumes the following:
//
// module: The module to which the method being registered belongs
//
// method: The name of the method being registered
//
// type: The HTTP verb used to make the request
//
// resourceDescription: an optional parameter which describes the resource
// being altered by the method. This is an array of strings which correspond to
// properties that the resource being requested/modified must have.
//
// handler: A function which returns a promise resolving to the payload (which
// should be a simple object) the function consumes one plus the number of
// parameters specified in resourceDescription (each of which corresponds to
// the parameter) the last item consumed is an object containing a description
// of the methods parameters.

module.exports = function apiFactory(log) {
  log = log || console;

  var router = express.Router();
  var endpoints = {};

  return {

    register: function(module, method, type, resourceDescription, handler) {
      if(typeof resourceDescription === 'function') {
        handler = resourceDescription;
        resourceDescription = [];
      }

      var id = module + ':' + method + ':' + type;

      if(endpoints[id])
        throw new Error('Attempt to register ' + id + ' twice');

      var path = '/' + module + '/' + method;

      for(var i=0;i<resourceDescription.length;i++) {
        path += '/:' + resourceDescription[i];
      }
      
      router[type.toLowerCase()](path, function(req, res) {
        var args = resourceDescription.map(function(i) { return req.params[i]; });
        args.push(req.body);

        handler.apply({}, args)
          .then(res.json.bind(res))
          .then(null, log.error);
      });

      endpoints[id] = { module: module,
                        method: method,
                        type: type,
                        path: path };
    },

    getApp: function() {
     var discovery = {};
     for(var k in endpoints) {
       var endpoint = endpoints[k];

       discovery[endpoint.module] = discovery[endpoint.module] || {};
       discovery[endpoint.module][endpoint.method] =
         discovery[endpoint.module][endpoint.method] || {};
       var desc = discovery[endpoint.module][endpoint.method];
       desc[endpoint.type] = endpoint.path;
     }


     var result = express();
     result.use(bodyParser.json());

     var firstRequest = true;
     result.use('/discovery', function(req, res) {
       if(firstRequest) {
         firstRequest = !firstRequest;
         var base = req.baseUrl.replace(/\/[^\/]*$/, '/resources');
         for(var module in discovery) {
           for(var method in discovery[module]) {
             for(var type in discovery[module][method]) {
               discovery[module][method][type] =
                 base + discovery[module][method][type];
             }
           }
         }
       }
       res.json(discovery);
       return;
     });

     result.use('/resources', router);
     return result;
    }
  };
};

