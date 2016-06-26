var querystring = require('querystring');
var http        = require('http');
var https       = require('https');
var cheerio     = require('cheerio');
var dns         = require('dns');

exports.DDNS = function (username, password, domain, domain_records)
{
    var domain_ipaddress = '';
    var ipaddress        = '';
    var contentType      = 'application/x-www-form-urlencoded';

    var data = querystring.stringify(
    {
        'data[Auth][challenge_key]' : '',
        'data[Customer][username]' : username,
        'data[Customer][password]' : password
    });

    dns.resolve4(domain, function (err, addresses)
    {
        if ( err )
        {
            console.log("Error: " + err.message);
        }

        domain_ipaddress = addresses[0];
    });

    var curip = https.get("https://api.ipify.org", function (ipres)
    {
        var html = '';

        ipres.on('data', function(data)
        {
            html += data.toString();
        });

        ipres.on('end', function()
        {
            ipaddress = html;

            if ( ipaddress !== '' && domain_ipaddress !== '' && ipaddress !== domain_ipaddress )
            {
                var msg = '';

                msg += 'Domain Address: ' + domain_ipaddress;
                msg += ' Current Address: ' + ipaddress;

                console.log(msg);

                var louhi_opts =
                {
                    host: 'oma.louhi.fi',
                    accept: '*/*',
                    port: 443,
                    path: '/customer/login',
                    method: 'POST',
                    headers:
                    {
                        'connection' : 'close',
                        'Content-Type': contentType,
                        'Content-Length': data.length
                    }
                };

                var louhilogin = https.request(louhi_opts, function (loginres)
                {
                    loginres.setEncoding('utf8');

                    if ( loginres.statusCode != 302 )
                    {
                        console.log('Login Failed!');
                    }
                    else
                    {
                        var cookies = {};
                        var setcook = loginres.headers['set-cookie'];

                        setcook[0].split(';').forEach(function (cookie)
                        {
                            var parts = cookie.split('=');
                            cookies[parts[0].trim()] = (parts[1] || '').trim();
                        });

                        if ( cookies )
                        {
                            louhi_opts.method  = 'GET';
                            louhi_opts.path    = '/customer/domain/' + domain;
                            louhi_opts.headers =
                            {
                                'connection' : 'close',
                                'Cookie' : 'OMALOUHI=' + cookies['OMALOUHI']
                            };

                            var domains = https.request(louhi_opts, function(domainres)
                            {
                                var html = '';

                                if ( domainres.statusCode == 200 )
                                {
                                    domainres.on('data', function (data)
                                    {
                                        html += data.toString();
                                    });

                                    domainres.on('end', function ()
                                    {
                                        var values = [8];
                                        var ctr = 0;
                                        var domains = [];

                                        $ = cheerio.load(html);

                                        $('.table_basic tr').each(function (i, elem)
                                        {
                                            var td = $(elem).find('td');

                                            if ( td.length )
                                            {
                                                var entry = {};

                                                td.each(function (i, elem)
                                                {
                                                    switch ( i )
                                                    {
                                                        case 0:
                                                        {
                                                            entry.record = $(this).text();

                                                            break;
                                                        }

                                                        case 1:
                                                        {
                                                            entry.type = $(this).text();

                                                            break;
                                                        }

                                                        case 2:
                                                        {
                                                            entry.ipaddress = $(this).text();

                                                            break;
                                                        }

                                                        case 6:
                                                        {
                                                            var value = parseInt($(this).text());

                                                            entry.ttl = value || 0;

                                                            break;
                                                        }

                                                        case 7:
                                                        {
                                                            var link = $(this).find('.dns_edit');

                                                            entry.link = link.attr('href');

                                                            break;
                                                        }
                                                    }
                                                });

                                                domains.push(entry);
                                            }
                                        });

                                        for ( var i = 0; i < domains.length; i++ )
                                        {
                                            for ( var x = 0; x < domain_records.length; x++ )
                                            {
                                                var entry = domains[i];

                                                if ( entry.record === domain_records[x]
                                                     && entry.type === 'A'
                                                     && entry.ipaddress !== ipaddress )
                                                {
                                                    var msg = '';

                                                    msg += 'Updating Domain(' + domain;
                                                    msg += ') Record(' + entry.record;
                                                    msg += ') To ' + ipaddress;

                                                    console.log(msg);

                                                    var recdata = querystring.stringify(
                                                    {
                                                        'data[Dnscommand][host]' : entry.record,
                                                        'data[Dnscommand][type]' : 'A',
                                                        'data[Dnscommand][value]' : ipaddress,
                                                        'data[Dnscommand][ttl]' : entry.ttl
                                                    });

                                                    louhi_opts.path    = domains[i].link;
                                                    louhi_opts.method  = 'POST';
                                                    louhi_opts.headers =
                                                    {
                                                        'connection' : 'close',
                                                        'Cookie' : 'OMALOUHI=' + cookies['OMALOUHI'],
                                                        'Content-Type': contentType,
                                                        'Content-Length': recdata.length
                                                    };

                                                    var updaterecord = https.request(louhi_opts,
                                                    function (upres)
                                                    {
                                                        if ( upres.statusCode != 302 )
                                                        {
                                                            var msg = '';

                                                            msg += 'Unable to update domain ';
                                                            msg += 'record!';

                                                            console.log(msg);
                                                        }

                                                        upres.on('data', function (chunk)
                                                        {
                                                            console.log(chunk);
                                                        });
                                                    });

                                                    updaterecord.on('error', function (err)
                                                    {
                                                        console.log('Error: ' + err.message);
                                                    });

                                                    updaterecord.write(recdata);
                                                    updaterecord.end();
                                                }
                                            }
                                        }

                                        louhi_opts.method  = 'GET';
                                        louhi_opts.path    = '/logout';
                                        louhi_opts.headers =
                                        {
                                            'connection' : 'close',
                                            'Cookie' : 'OMALOUHI=' + cookies['OMALOUHI'],
                                        };

                                        var logout = https.request(louhi_opts, function (logoutres)
                                        {
                                            if ( logoutres.statusCode !== 302 )
                                            {
                                                console.log('Unable to logout!');
                                            }
                                            else
                                            {
                                                console.log('All Done.');
                                            }
                                        });

                                        logout.on('error', function (err)
                                        {
                                            console.log('Error: ' + err.message);
                                        });

                                        setTimeout((function ()
                                        {
                                            logout.end();
                                        }), 2000);
                                    });
                                }
                                else
                                {
                                    console.log('Unable to get domains!');
                                }
                            });

                            domains.on('error', function (err)
                            {
                                console.log('Error: ' + err.message);
                            });

                            domains.end();
                        }
                        else
                        {
                            console.log('Missing Cookie!');
                        }
                    }
                });

                louhilogin.on('error', function (err)
                {
                    console.log('Error: ' + err.message);
                });

                louhilogin.write(data);
                louhilogin.end();
            }

            if ( ipaddress !== '' && domain_ipaddress !== '' && ipaddress === domain_ipaddress )
            {
                console.log('All Done.');
            }
        });
    });

    curip.on('error', function (err)
    {
        console.log('Error: ' + err.message);
    });
}
