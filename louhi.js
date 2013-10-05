var querystring = require('querystring');
var http = require('http');
var https = require('https');
var cheerio = require('cheerio');
var dns = require('dns');

exports.DDNS = function(username, password, domain, domain_records) {
	var domain_ipaddress = "";
	var ipaddress = "";

	var data = querystring.stringify({
		'data[Auth][challenge_key]' : '', 
		'data[Customer][username]' : username,
		'data[Customer][password]' : password
	});

	dns.resolve4(domain, function (err, addresses) {
		if (err) {
			console.log("Error: " + err.message);
		}

		domain_ipaddress = addresses[0];
	});

	var curip = http.get("http://whatismyipaddress.com/ip-lookup", function(ipres) {
		var chunks = [];
		ipres.on('data', function(chunk) {
			chunks.push(chunk);
		});

		ipres.on('end', function() {
			$ = cheerio.load(chunks);

			$('input[name=LOOKUPADDRESS]').each(function(i, elem) {
				ipaddress = $(this).val();
			});

			if (ipaddress != "" && domain_ipaddress != "" && ipaddress != domain_ipaddress) {
				console.log("Domain Address: " + domain_ipaddress + " Current Address: " + ipaddress);

				var louhi_opts = {
					host: "oma.louhi.fi",
					accept: '*/*',
					port: 443,
					path: "/customer/login",
					method: 'POST',
					headers: {
						'connection' : 'close',
						'Content-Type': 'application/x-www-form-urlencoded',
						'Content-Length': data.length
					}
				};

				var louhilogin = https.request(louhi_opts, function(loginres) {
					loginres.setEncoding('utf8');

					if (loginres.statusCode != 302) {
						console.log("Login Failed!\n");
					} else {
						var cookies = {};
						var setcook = loginres.headers['set-cookie'];
						setcook[0].split(";").forEach(function(cookie) {
							var parts = cookie.split('=');
							cookies[parts[0].trim()] = (parts[1] || '').trim();
						});

						if (cookies) {
							louhi_opts.method = "GET";
							louhi_opts.path = "/customer/domain/" + domain;
							louhi_opts.headers = { 
								'connection' : 'close', 
								'Cookie' : 'OMALOUHI=' + cookies['OMALOUHI'], 
							};

							var domains = https.request(louhi_opts, function(domainres) {
								var chunks = [];

								if (domainres.statusCode == 200) {
									domainres.on('data', function(chunk) {
										chunks.push(chunk);
									});

									domainres.on('end', function() {
										var values = [4];
										var ctr = 0;
										var domains = [];

										$ = cheerio.load(chunks);

										$('.table_basic td').each(function(i, elem) {
											if ((i - ctr) < 4) {
												values[(i - ctr)] = $(this).text();
											} else {
												ctr += 5;
												domains.push({record: values[0], type: values[1], value: values[2], mx: values[3], link: ""});
											}
										});

										$('a.dns_edit').each(function(i, elem) {
											domains[i].link = $(this).attr('href');
										});
								
										for (var i = 0; i < domains.length; i++) {
											for (var x = 0; x < domain_records.length; x++) {
												if (domains[i].record == domain_records[x] && domains[i].type == "A" && domains[i].value != ipaddress) {
													console.log("Updating Domain(" + domain + ") Record(" + domains[i].record + ") To " + ipaddress);

													var recdata = querystring.stringify({
														'data[Dnscommand][host]' : domains[i].record,
														'data[Dnscommand][type]' : 'A',
														'data[Dnscommand][value]' : ipaddress,
														'data[Dnscommand][mx]' : 0
													});

													louhi_opts.path = domains[i].link;
													louhi_opts.method = 'POST';
													louhi_opts.headers = {
														'connection' : 'close',
														'Cookie' : 'OMALOUHI=' + cookies['OMALOUHI'],
														'Content-Type': 'application/x-www-form-urlencoded',
														'Content-Length': recdata.length,
													};

													var updaterecord = https.request(louhi_opts, function(upres) {
														if (upres.statusCode != 302) {
															console.log("Unable to update domain record!");
														}

														upres.on('data', function(chunk) {
															console.log(chunk);
														});
													});

													updaterecord.on('error', function(err) {
														console.log("Error: " + err.message);
													});

													updaterecord.write(recdata);
													updaterecord.end();
												}
											}	
										}

										louhi_opts.method = 'GET';
										louhi_opts.path = "/logout";
										louhi_opts.headers = {
											'connection' : 'close',
											'Cookie' : 'OMALOUHI=' + cookies['OMALOUHI'],
										};

										var logout = https.request(louhi_opts, function(logoutres) {
											if (logoutres.statusCode != 302) {
												console.log("Unable to logOut!");
											} else {
												console.log("All Done!\n");
											}
										});

										logout.on('error', function(err) {
											console.log("Error: " + err.message);
										});

										setTimeout((function() {
											logout.end();
										}), 2000);									
									});
								} else {
									console.log("Unable to get domains!\n");
								}
							});

							domains.on('error', function(err) {
								console.log("Error: " + err.message);
							});

							domains.end();
						} else {
							console.log("Missing Cookie!\n");
						}
					}
				});

				louhilogin.on('error', function(err) {
					console.log("Error: " + err.message);
				});

				louhilogin.write(data);
				louhilogin.end();
			}

			if (ipaddress != "" && domain_ipaddress != "" && ipaddress == domain_ipaddress) {
				console.log("All Done!\n");
			}
		});
	});

	curip.on('error', function(err) {
		console.log("Error: " + err.message);
	});
}
