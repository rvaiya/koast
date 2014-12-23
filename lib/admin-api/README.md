# Koast Admin API

##So you want an admin API, huh kid?

The Koast admin API is a configurable Koast module that can be used to control a
running Koast instance. It is possible to configure it to administer a remote
Koast instance (i.e not the one on which it is being hosted) by passing in the
appropriate configuration parameters. Since the API is exposed as a simple Koast
module it is also possible to have a single Koast instance host the admin console
for multiple Koast servers.

## Setting up an admin API

The admin-api module exposes a function which consumes a configuration object
and returns a promise which resolves to the admin API Koast module.  This module
can then be used like any other koast module.

```javascript
var adminAPI = require('koast');

exports.KoastModule = 
  adminAPI.genAPIModule({
    /* Configuration Parameters */
  });
```
##Configuration Parameters

```javascript
var adminConfig = {
  aws: {
    key: process.env.AWS_KEY,
    secret: process.env.AWS_SECRET
  },
  
  backups: {
    target: 'mongodb://localhost:27017/koast_db', //Database to backup
  }

  database: { //Database used to store admin metadata
    url: 'mongodb://localhost:27017/koast_admin_db'
  }
};
``` 

## Moving forward

The route exposed by the admin API module contains a /discovery path. The
payload of this path is an object which should be used to derive the paths of
any documented 'methods'. Its structure is as follows

{
  module1: {
    method1: { "GET": "/path/to/module1_method1", "POST": "/path/to/module1_method1" },
    method2: { "GET": "/path/to/module1_method2" }
    .
    .
  }

  module2: {
    method1: { "GET": "/path/to/module2_method1", "POST": "/path/to/module2_method1" },
    method2: { "GET": "/path/to/module2_method2" }
    .
    .
  }
  .
  .
  .
}
