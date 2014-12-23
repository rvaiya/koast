// Useful general purpose functions for use with Ramda

var Rutil = {};

// Consumes a list of keys and returns the values corresponding to those keys in
// the supplied object (or a function which does so)

Rutil.pickList = function(keys, obj) {
  var curried = function(obj) {
    var result = [];
    keys.map(function(k) {
      result.push(obj[k]);
    });
    return result;
  };

  return obj ? curried(obj) : curried;
};

// Consumes a function following the node convention of function(error, data)
// and either throws an error (if error is present) or returns data

Rutil.denodify = function(err, data) {
  if(err) throw err;
  return data;
};

module.exports = Rutil;
