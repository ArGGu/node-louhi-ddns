node-louhi-ddns
===============

Dynamic DNS update tool for [oma.louhi.fi](https://oma.louhi.fi)

### Install:

    npm install vmolsa/node-louhi-ddns
    
### Example

    var louhi = require('node-louhi-ddns');

    var username = "username";
    var password = "password";
    var domain = "example.com";
    var records = [ '@', 'www' ];

    louhi.DDNS(username, password, domain, records);

